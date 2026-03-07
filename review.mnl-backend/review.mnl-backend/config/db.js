const mysql = require('mysql2/promise');
require('dotenv').config();

// Support both Railway MySQL variable names and local .env names
const pool = mysql.createPool({
  host:     process.env.MYSQLHOST     || process.env.DB_HOST,
  port:     process.env.MYSQLPORT     || process.env.DB_PORT || 3306,
  user:     process.env.MYSQLUSER     || process.env.DB_USER,
  password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.MYSQLHOST ? { rejectUnauthorized: false } : undefined,
});

module.exports = pool;
