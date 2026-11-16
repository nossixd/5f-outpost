require('dotenv').config();
const { createServer } = require('./src/server');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const mode = process.env.DATA_SOURCE || 'demo';
const server = createServer({ mode });
server.on('error', error => { console.error('Nie można uruchomić serwera:', error.message); process.exitCode = 1; });
server.listen(port, host, () => console.log(`OUTPOST: http://${host}:${server.address().port}`));

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async error => {
    if (error) {
      console.error('Nie udało się zamknąć serwera.');
      process.exitCode = 1;
    }
    const databaseModule = require.cache[require.resolve('./src/database/db')];
    if (databaseModule) {
      try {
        await databaseModule.exports.end();
      } catch {
        console.error('Nie udało się zamknąć puli PostgreSQL.');
        process.exitCode = 1;
      }
    }
    process.exitCode = process.exitCode || 0;
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
