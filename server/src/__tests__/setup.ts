import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../../.env') });

const { pool } = await import('../db/pool.js');

beforeEach(async () => {
  await pool.query(`TRUNCATE otp_codes, relationships, persons, trees, users RESTART IDENTITY CASCADE`);
});

afterAll(async () => { await pool.end(); });
