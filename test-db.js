const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('SUCCESS: Connected to database at', res.rows[0].now);
    process.exit(0);
  } catch (err) {
    console.error('ERROR: Database connection failed:', err.message);
    process.exit(1);
  }
}

test();
