const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { evaluateDelay, timestamp } = require('./delays');
const { createOrderStore } = require('./orders');
const { createFleetStore } = require('./fleet');
const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/fleet.js': ['fleet.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/leaflet/leaflet.css': ['leaflet/dist/leaflet.css', 'text/css; charset=utf-8'],
  '/leaflet/leaflet.js': ['leaflet/dist/leaflet.js', 'text/javascript; charset=utf-8'],
  '/leaflet/images/marker-icon.png': ['leaflet/dist/images/marker-icon.png', 'image/png'],
  '/leaflet/images/marker-icon-2x.png': ['leaflet/dist/images/marker-icon-2x.png', 'image/png'],
  '/leaflet/images/marker-shadow.png': ['leaflet/dist/images/marker-shadow.png', 'image/png'],
};
function isLocalRequest(req) {
  const address = req.socket.remoteAddress;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
function isSameOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsedOrigin = new URL(origin);
    const requestProtocol = req.socket.encrypted ? 'https:' : 'http:';
    return parsedOrigin.protocol === requestProtocol && parsedOrigin.host === req.headers.host;
  } catch {
    return false;
  }
}
function createServer({
  mode = 'demo',
  getOrders,
  store = createOrderStore(mode),
  fleetStore = createFleetStore(),
  authorizeCompletion,
} = {}) {
  if (!['demo', 'postgres'].includes(mode)) throw new Error('DATA_SOURCE: dozwolone demo lub postgres.');
  const authorize = authorizeCompletion
    || (mode === 'demo' || process.env.DEMO_COMPLETION_AUTH === 'true'
      ? req => isLocalRequest(req) ? ({ role: 'demo-authorized', userId: null }) : null
      : () => null);
  const list = getOrders || (() => store.list());
  const snapshot = async () => ({ orders: (await list()).map(order => evaluateDelay(order, 5)) });
  return http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const completionMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/complete$/);
      const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
      if (req.method === 'PATCH' && (completionMatch || orderMatch)) {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Wymagany format JSON.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 8192) return send(413, { error: 'Zbyt duże żądanie.' });
        }
        let command;
        try { command = JSON.parse(body); } catch { return send(400, { error: 'Nieprawidłowy JSON.' }); }
        let id;
        try {
          id = decodeURIComponent((completionMatch || orderMatch)[1]);
        } catch {
          return send(400, { error: 'Nieprawidłowy identyfikator zlecenia.' });
        }
        if (!id || id.length > 128 || id.trim() !== id || /[\u0000-\u001f\u007f/]/.test(id)) {
          return send(400, { error: 'Nieprawidłowy identyfikator zlecenia.' });
        }
        if (completionMatch) {
          if (!command || Array.isArray(command) || typeof command !== 'object' || Object.keys(command).length !== 0) {
            return send(400, { error: 'Zakończenie nie przyjmuje dodatkowych danych.' });
          }
          const principal = await authorize(req);
          if (!principal) return send(403, { error: 'Brak uprawnienia do zakończenia transportu.' });
          const completedBy = typeof principal.userId === 'string'
            && principal.userId.trim().length > 0 && principal.userId.length <= 256
            ? principal.userId.trim() : null;
          const order = await store.complete(id, completedBy);
          if (!order) return send(404, { error: 'Nie znaleziono zlecenia.' });
          const data = await snapshot();
          const current = data.orders.find(item => item.id === id) || order;
          return send(200, { ...data, order: { ...current, delayStatus: current.status, status: current.transportStatus } });
        }
        if (!command || !['approve', 'reject', 'reschedule'].includes(command.action)) return send(400, { error: 'Nieprawidłowa akcja.' });
        if (command.action === 'reschedule' && !Number.isFinite(timestamp(command.eta))) return send(400, { error: 'Podaj prawidłowy czas przyjazdu ze strefą czasową.' });
        if (!await store.update(id, command.action, command.eta)) return send(404, { error: 'Nie znaleziono zlecenia.' });
        return send(200, await snapshot());
      }
      if (req.method !== 'GET') return send(405, { error: 'Niedozwolona metoda.' });
      if (url.pathname === '/api/delays') return send(200, await snapshot());
      if (url.pathname === '/api/vehicles') {
        if (mode !== 'postgres') {
          return send(503, { error: 'Monitoring floty wymaga DATA_SOURCE=postgres i skonfigurowanej bazy.' });
        }
        return send(200, { vehicles: await fleetStore.list(), staleAfterSeconds: 30 });
      }
      const asset = assets[url.pathname];
      if (!asset) return send(404, { error: 'Nie znaleziono zasobu.' });
      const base = asset[0].startsWith('leaflet/')
        ? path.join(__dirname, '../node_modules')
        : path.join(__dirname, '../public');
      const body = await readFile(path.resolve(base, asset[0]));
      res.writeHead(200, { 'Content-Type': asset[1], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self' https://tile.openstreetmap.org; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      res.end(body);
    } catch (error) {
  console.error('[OUTPOST] Żądanie zakończyło się błędem.');

  if (error.statusCode === 409) {
    return send(409, { error: error.message });
  }

  if ([400, 422, 502].includes(error.statusCode)) {
    return send(error.statusCode, { error: error.message });
  }

  if (error.statusCode === 503) {
    return send(503, { error: 'Nie udało się pobrać danych. Spróbuj ponownie.' });
  }

  return send(503, {
    error: 'Nie udało się pobrać danych. Spróbuj ponownie.'
  });
}
  });
}
module.exports = { createServer };
