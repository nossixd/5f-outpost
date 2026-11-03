const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { evaluateDelay } = require('./delays');
const { loadOrders } = require('./orders');
const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
function createServer({ mode = 'demo', getOrders = () => loadOrders(mode) } = {}) {
  if (!['demo', 'postgres'].includes(mode)) throw new Error('DATA_SOURCE: dozwolone demo lub postgres.');
  return http.createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET') return send(405, { error: 'Dozwolona jest metoda GET.' });
      if (url.pathname === '/api/delays') {
        const raw = url.searchParams.get('threshold');
        const threshold = raw === null ? 5 : raw.trim() === '' ? NaN : Number(raw);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1440) return send(400, { error: 'Próg musi być liczbą od 0 do 1440 minut.' });
        const orders = (await getOrders()).map(order => evaluateDelay(order, threshold));
        return send(200, { mode, thresholdMinutes: threshold, orders });
      }
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
