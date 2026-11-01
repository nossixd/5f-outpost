const pool = require("./src/database/db");

async function testConnection() {
  try {
    const result = await pool.query("SELECT current_database()");
    console.log("Połączono z bazą:", result.rows[0].current_database);
  } catch (error) {
    console.error("Błąd połączenia:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();