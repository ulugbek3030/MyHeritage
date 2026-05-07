import { describe, it, expect } from 'vitest';
import { pool } from '../db/pool.js';
import { computeEvents } from '../services/events.service.js';

describe('events.service', () => {
  it('returns birthday events for next year', async () => {
    const u = await pool.query(`INSERT INTO users (phone) VALUES ('+998900000099') RETURNING id`);
    const t = await pool.query(`INSERT INTO trees (user_id, name) VALUES ($1, 'T') RETURNING id`, [u.rows[0].id]);
    await pool.query(`INSERT INTO persons (tree_id, first_name, gender, birth_date, birth_date_known) VALUES ($1, 'A', 'male', '1980-06-15', true)`, [t.rows[0].id]);
    const events = await computeEvents(t.rows[0].id, new Date('2026-01-01'), new Date('2027-12-31'));
    const bd = events.filter((e) => e.type === 'birthday');
    expect(bd.length).toBeGreaterThan(0);
    expect(bd[0].meta.name).toContain('A');
  });
});
