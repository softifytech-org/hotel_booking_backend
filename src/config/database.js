const { Pool } = require('pg');

const isLocalDb = (process.env.DATABASE_URL || '').includes('localhost') ||
                  (process.env.DATABASE_URL || '').includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Disable prepared statements for Supabase pgBouncer transaction mode
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  console.error('Unexpected DB client error:', err.message);
});

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Supabase connection failed:', err.message);
  } else {
    console.log('✅ Supabase PostgreSQL connected');
    release();
  }
});

module.exports = pool;
