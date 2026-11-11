const { createServer } = require('./src/server');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = createServer({ mode: process.env.DATA_SOURCE || 'demo' });
server.on('error', error => { console.error('Nie można uruchomić serwera:', error.message); process.exitCode = 1; });
server.listen(port, host, () => console.log(`OUTPOST: http://${host}:${server.address().port}`));
