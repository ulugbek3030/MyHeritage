import fs from 'fs';
import path from 'path';
import { pool, query } from './pool.js';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

async function migrate() {
  console.log('🔄 Running migrations...\n');

  // Create migrations tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get already applied migrations
  const applied = await query('SELECT name FROM _migrations ORDER BY id');
  const appliedNames = new Set(applied.rows.map((r: any) => r.name));

  // Read migration files (sorted)
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.includes('006_create_migrations'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`  ✅ ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    try {
      await query(sql);
      await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`  🆕 ${file} — applied`);
      count++;
    } catch (err: any) {
      console.error(`  ❌ ${file} — FAILED:`, err.message);
      process.exit(1);
    }
  }

  console.log(`\n✅ Done. ${count} new migration(s) applied.`);
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
