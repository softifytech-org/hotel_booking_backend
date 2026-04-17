const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createAdmin() {
  try {
    const email = 'admin@saas.com';
    const password = 'admin123';
    const role = 'SUPER_ADMIN';
    const name = 'Platform Admin';

    console.log('Connecting to database...');
    // Create connection and check
    const client = await pool.connect();
    
    // Hash password just like the backend auth expects. Or use the hash from schema.sql.
    // The hash from schema is '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewqVaMH5fGByHsLe'
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Check if user exists
    const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rowCount > 0) {
      console.log('User already exists, updating password and role...');
      await client.query(
        'UPDATE users SET password_hash = $1, role = $2 WHERE email = $3',
        [passwordHash, role, email]
      );
      console.log('User updated successfully.');
    } else {
      console.log('User not found. Creating default admin...');
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, organization_id)
         VALUES ($1, $2, $3, $4, NULL)`,
        [name, email, passwordHash, role]
      );
      console.log('Admin user created successfully.');
    }
    
    client.release();
    process.exit(0);
  } catch (error) {
    console.error('Error in createAdmin:', error);
    process.exit(1);
  }
}

createAdmin();
