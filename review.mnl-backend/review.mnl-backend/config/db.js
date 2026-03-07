const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

// Railway injects DATABASE_URL or MYSQL_URL as a connection string
const connectionString = process.env.DATABASE_URL || process.env.MYSQL_URL;

if (connectionString) {
  // Append SSL disable for Railway (their MySQL doesn't require strict TLS)
  const urlWithSsl = connectionString.includes('?')
    ? connectionString + '&ssl={"rejectUnauthorized":false}'
    : connectionString + '?ssl={"rejectUnauthorized":false}';
  pool = mysql.createPool(urlWithSsl);
} else {
  // Local development fallback
  pool = mysql.createPool({
    host:     process.env.MYSQLHOST     || process.env.DB_HOST     || 'localhost',
    port:     process.env.MYSQLPORT     || process.env.DB_PORT     || 3306,
    user:     process.env.MYSQLUSER     || process.env.DB_USER     || 'root',
    password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME   || 'reviewmnl_db',
    waitForConnections: true,
    connectionLimit: 10,
  });
}

module.exports = pool;
