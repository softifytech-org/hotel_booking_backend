/**
 * Database Migration Runner
 * Connects to Supabase and creates all tables from schema.sql
 * Run: node src/config/migrate.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  console.log('\n🔌 Connected to Supabase PostgreSQL\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split into individual statements (skip empty lines and comments)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Running ${statements.length} SQL statements...\n`);

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
      const preview = statement.substring(0, 60).replace(/\n/g, ' ').trim();
      try {
        await client.query(statement);
        console.log(`  ✅ ${preview}...`);
        successCount++;
      } catch (err) {
        // "already exists" errors are fine — idempotent migration
        if (
          err.message.includes('already exists') ||
          err.message.includes('duplicate') ||
          err.code === '42710' || // duplicate object
          err.code === '42P07' || // duplicate table
          err.code === '42723'    // duplicate function
        ) {
          console.log(`  ⏭️  SKIP (already exists): ${preview}...`);
          skipCount++;
        } else {
          console.error(`  ❌ FAILED: ${preview}`);
          console.error(`     Error: ${err.message}\n`);
        }
      }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`✅ Migration complete!`);
    console.log(`   ✔  Executed: ${successCount}`);
    console.log(`   ⏭  Skipped:  ${skipCount}`);
    console.log(`═══════════════════════════════════════`);

    // Verify tables exist
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    console.log(`\n📊 Tables in database:`);
    rows.forEach(r => console.log(`   → ${r.tablename}`));

    // Verify super admin seeded
    const adminCheck = await client.query(
      `SELECT id, name, email, role FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1`
    );
    if (adminCheck.rows.length > 0) {
      const admin = adminCheck.rows[0];
      console.log(`\n👤 Super Admin seeded:`);
      console.log(`   Name:  ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role:  ${admin.role}`);
      console.log(`\n🔑 Login: admin@saas.com / admin123\n`);
    }

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
