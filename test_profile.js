// Test script to diagnose profile edit issues
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './review_mnl/review.mnl-backend/review.mnl-backend/.env' });

async function test() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✓ Connected to database');

    // Check if columns exist
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = ?`,
      [process.env.DB_NAME]
    );

    const columnNames = columns.map(c => c.COLUMN_NAME);
    console.log('\n📋 Users table columns:', columnNames);

    const requiredColumns = ['phone', 'address', 'bio', 'profile_picture_url'];
    const missing = requiredColumns.filter(col => !columnNames.includes(col));

    if (missing.length > 0) {
      console.log('\n❌ MISSING COLUMNS:', missing);
      console.log('Adding missing columns...');
      for (const col of missing) {
        if (col === 'bio') {
          await connection.query('ALTER TABLE users ADD COLUMN bio TEXT');
        } else if (col === 'profile_picture_url') {
          await connection.query('ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500)');
        } else {
          await connection.query(`ALTER TABLE users ADD COLUMN ${col} VARCHAR(500)`);
        }
        console.log(`✓ Added ${col}`);
      }
    } else {
      console.log('✓ All required columns exist');
    }

    // Check if a test user has values
    const [users] = await connection.query('SELECT id, first_name, last_name, email, phone, address, bio FROM users LIMIT 1');
    if (users.length > 0) {
      console.log('\n👤 Sample user:', users[0]);
    }

    await connection.end();
    console.log('\n✓ Test completed successfully');
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

test();
