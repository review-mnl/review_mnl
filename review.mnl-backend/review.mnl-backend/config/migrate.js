const fs = require('fs');
const path = require('path');
const db = require('./db');

/**
 * Migration script: Initializes database schema on first run
 * Reads schema.sql and executes it if tables don't exist
 */
async function runMigration() {
  try {
    // Check if tables already exist
    const [tables] = await db.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE()');
    
    if (tables[0].count > 0) {
      console.log('✓ Database schema already initialized');
      return;
    }

    console.log('→ Initializing database schema...');
    
    // Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema (split by ; to handle multiple statements)
    const statements = schemaSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    for (const statement of statements) {
      await db.query(statement);
    }
    
    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

module.exports = { runMigration };
