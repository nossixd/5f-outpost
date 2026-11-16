require("dotenv").config();
const { Pool } = require("pg");

const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const missing = required.filter(name => process.env[name] === undefined || process.env[name] === "");
const port = process.env.DB_PORT === undefined ? 5432 : Number(process.env.DB_PORT);
if (missing.length || !Number.isInteger(port) || port < 1 || port > 65535) {
  const details = missing.length ? ` Brak: ${missing.join(", ")}.` : "";
  const invalidPort = !Number.isInteger(port) || port < 1 || port > 65535
    ? " DB_PORT musi być liczbą z zakresu 1–65535."
    : "";
  throw new Error(`Nieprawidłowa konfiguracja PostgreSQL.${details}${invalidPort}`);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;