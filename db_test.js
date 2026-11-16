async function testConnection() {
  let pool;
  try {
    pool = require("./src/database/db");
    const result = await pool.query("SELECT 1 AS connected, current_database()");
    console.log("Połączono z bazą:", result.rows[0].current_database);
  } catch (error) {
    console.error(error.message.startsWith("Nieprawidłowa konfiguracja PostgreSQL.")
      ? error.message
      : "Nie udało się połączyć z PostgreSQL. Sprawdź konfigurację DB_* i dostępność serwera.");
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

testConnection();