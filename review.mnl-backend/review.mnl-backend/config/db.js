const mysql = require('mysql2/promise');
require('dotenv').config();

// Railway MySQL plugin exposes MYSQL* variables.
// Prefer those in production so the API and Railway Data tab point to the same database.
const host = process.env.MYSQLHOST || process.env.DB_HOST;
const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
const user = process.env.MYSQLUSER || process.env.DB_USER;
const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD;
const database = process.env.MYSQLDATABASE || process.env.DB_NAME;

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
if (isProduction) {
  const missingRailwayVars = ['MYSQLHOST', 'MYSQLPORT', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE']
    .filter((k) => !process.env[k]);
  if (missingRailwayVars.length > 0) {
    throw new Error(
      'Production startup blocked: missing Railway MySQL variables: ' + missingRailwayVars.join(', ')
    );
  }
}

const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
