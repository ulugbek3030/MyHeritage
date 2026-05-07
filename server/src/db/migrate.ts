import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../../database/migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function applied(): Promise<Set<string>> {
  const r = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(r.rows.map((x) => x.filename));
}

async function run() {
  await ensureMigrationsTable();
  const done = await applied();
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const f of files) {
    if (done.has(f)) {
      console.log(`[skip] ${f}`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, f), 'utf-8');
    console.log(`[apply] ${f}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
    }
  }
  await pool.end();
  console.log('[done] all migrations applied');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
