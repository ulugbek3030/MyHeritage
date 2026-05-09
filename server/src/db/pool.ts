import pg from 'pg';
import { env } from '../config/env.js';

// pg-types parses DATE columns via `new Date(year, month, day)` — that's a
// LOCAL-timezone constructor, so on a server in Europe/Prague (UTC+2 in
// summer) the DATE 1987-05-18 becomes UTC 1987-05-17T22:00. JSON.stringify
// then ships "...T22:00:00.000Z", which the client slices back to
// "1987-05-17" and displays as 17 May. Tell pg to keep DATE as the raw
// "YYYY-MM-DD" string — the client receives the stored date verbatim, no
// timezone arithmetic.
const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val) => val);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

export const query = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> => pool.query(text, params) as any;
