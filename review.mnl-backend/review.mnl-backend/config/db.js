const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

// Railway injects MYSQL_URL automatically — use it if available
if (process.env.MYSQL_URL) {
  pool = mysql.createPool(process.env.MYSQL_URL + '?ssl={"rejectUnauthorized":false}');
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
