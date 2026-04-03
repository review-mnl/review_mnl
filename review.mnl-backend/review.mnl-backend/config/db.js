const mysql = require('mysql2/promise');
require('dotenv').config();

// Railway may expose MySQL credentials either as discrete MYSQL* vars
// or as a single connection URL.
const mysqlUrl = process.env.MYSQL_URL || process.env.MYSQL_URL_NON_POOLING || process.env.DATABASE_URL;

const host = process.env.MYSQLHOST || process.env.DB_HOST;
const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
const user = process.env.MYSQLUSER || process.env.DB_USER;
const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD;
const database = process.env.MYSQLDATABASE || process.env.DB_NAME;

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
if (isProduction) {
  const hasUrl = Boolean(mysqlUrl);
  const hasDiscrete = Boolean(host && user && password && database);
  if (!hasUrl && !hasDiscrete) {
    throw new Error(
      'Production startup blocked: no valid MySQL config found. Expected MYSQL_URL/DATABASE_URL or host/user/password/database variables.'
    );
  }
}

let poolConfig;
if (mysqlUrl) {
  const parsed = new URL(mysqlUrl);
  poolConfig = {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database: (parsed.pathname || '').replace(/^\//, ''),
    waitForConnections: true,
    connectionLimit: 10,
  };
} else {
  poolConfig = {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
  };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
