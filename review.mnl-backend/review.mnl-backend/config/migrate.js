const fs = require('fs');
const path = require('path');
const db = require('./db');

/**
 * Migration script: Initializes database schema on first run
 * Reads schema.sql and executes it if tables don't exist
 * Always ensures superadmin account exists
 */
async function runMigration() {
  try {
    // Check if tables already exist
    const [tables] = await db.query('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE()');
    
    if (tables[0].count > 0) {
      console.log('✓ Database schema already initialized');
    } else {
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
      return;
    }

    // Ensure superadmin account exists (even if tables already existed)
    const [admin] = await db.query('SELECT id FROM users WHERE email = ?', ['review-mnlsuperadmin@gmail.com']);
    if (admin.length === 0) {
      console.log('→ Creating superadmin account...');
      await db.query(
        `INSERT INTO users (first_name, last_name, email, password, role, is_verified)
         VALUES ('Super', 'Admin', 'review-mnlsuperadmin@gmail.com', 
         '$2a$10$mxJ/ChVcu3oEMlLT2ES4me/RklfyaXspADkkHLi.r8uHEqd.r3x0O', 'superadmin', 1)`
      );
      console.log('✓ Superadmin account created');
    } else {
      console.log('✓ Superadmin account already exists');
    }
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

module.exports = { runMigration };
