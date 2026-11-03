const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { evaluateDelay, timestamp } = require('./delays');
const { createOrderStore } = require('./orders');
const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
function createServer({ mode = 'demo', getOrders, store = createOrderStore(mode) } = {}) {
  const list = getOrders || (() => store.list());
  const snapshot = async () => ({ orders: (await list()).map(order => evaluateDelay(order, 5)) });
  if (!['demo', 'postgres'].includes(mode)) throw new Error('DATA_SOURCE: dozwolone demo lub postgres.');
  return http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'PATCH' && url.pathname.startsWith('/api/orders/')) {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Wymagany format JSON.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 8192) return send(413, { error: 'Zbyt duże żądanie.' });
        }
        let command;
        try { command = JSON.parse(body); } catch { return send(400, { error: 'Nieprawidłowy JSON.' }); }
        if (!command || !['approve', 'reject', 'reschedule'].includes(command.action)) return send(400, { error: 'Nieprawidłowa akcja.' });
        if (command.action === 'reschedule' && !Number.isFinite(timestamp(command.eta))) return send(400, { error: 'Podaj prawidłowy czas przyjazdu ze strefą czasową.' });
        const id = decodeURIComponent(url.pathname.slice('/api/orders/'.length));
        if (!await store.update(id, command.action, command.eta)) return send(404, { error: 'Nie znaleziono zlecenia.' });
        return send(200, await snapshot());
      }
      if (req.method !== 'GET') return send(405, { error: 'Niedozwolona metoda.' });
      if (url.pathname === '/api/delays') return send(200, await snapshot());
      const asset = assets[url.pathname];
      if (!asset) return send(404, { error: 'Nie znaleziono zasobu.' });
      const body = await readFile(path.join(__dirname, '../public', asset[0]));
      res.writeHead(200, { 'Content-Type': asset[1], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      res.end(body);
    } catch {
      send(503, { error: 'Nie udało się pobrać danych. Spróbuj ponownie.' });
    }
  });
}
module.exports = { createServer };
