import { pool, query } from '../db/pool.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export interface TreeAccessRequest extends Record<string, unknown> {
  id: string;
  requesterId: string;
  requesterDisplayName: string | null;
  requesterPhone: string | null;
  targetPhone: string;
  targetUserId: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
}

const REQUEST_COLS = `
  tar.id,
  tar.requester_id      AS "requesterId",
  u.display_name        AS "requesterDisplayName",
  u.phone               AS "requesterPhone",
  tar.target_phone      AS "targetPhone",
  tar.target_user_id    AS "targetUserId",
  tar.status,
  tar.message,
  tar.created_at        AS "createdAt",
  tar.responded_at      AS "respondedAt"
`;

const normalisePhone = (raw: string): string => {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

/** Whether the calling user is allowed to request tree access of others. */
export const userIsIdentified = async (userId: string): Promise<boolean> => {
  const r = await query<{ is_identified: boolean }>(
    `SELECT is_identified FROM users WHERE id = $1`,
    [userId]
  );
  return r.rows[0]?.is_identified ?? false;
};

/**
 * Create a new tree-access request from `requesterId` to whoever owns the
 * given phone number. Idempotent on (requester, target) — re-requesting a
 * pending request returns the existing one rather than erroring.
 */
export const createRequest = async (
  requesterId: string,
  rawPhone: string,
  message: string | null,
): Promise<TreeAccessRequest> => {
  if (!await userIsIdentified(requesterId)) {
    throw new BadRequestError('not_identified');
  }
  const phone = normalisePhone(rawPhone);
  if (!/^\+?\d{9,15}$/.test(phone)) {
    throw new BadRequestError('Invalid phone format');
  }
  // Look up the target user — they may not exist yet, in which case we
  // store the request with target_user_id = NULL and reconcile when they
  // first sign in (TODO: handle that path).
  const t = await query<{ id: string }>(
    `SELECT id FROM users WHERE phone = $1 LIMIT 1`,
    [phone]
  );
  const targetUserId = t.rows[0]?.id ?? null;
  if (targetUserId === requesterId) {
    throw new BadRequestError('Cannot request access from yourself');
  }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // Drop any prior accepted grant going the other way? — no, keep history.
    const existing = await c.query<{ id: string }>(
      `SELECT id FROM tree_access_requests
       WHERE requester_id = $1
         AND status = 'pending'
         AND COALESCE(target_user_id::text, target_phone) = COALESCE($2::text, $3)`,
      [requesterId, targetUserId, phone]
    );
    let id: string;
    if (existing.rows[0]) {
      id = existing.rows[0].id;
    } else {
      const ins = await c.query<{ id: string }>(
        `INSERT INTO tree_access_requests (requester_id, target_phone, target_user_id, message)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [requesterId, phone, targetUserId, message]
      );
      id = ins.rows[0].id;
    }
    await c.query('COMMIT');
    return await getRequest(id);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};

/** Outgoing — requests this user has SENT. */
export const listOutgoing = async (userId: string): Promise<TreeAccessRequest[]> => {
  const r = await query<TreeAccessRequest>(
    `SELECT ${REQUEST_COLS}
     FROM tree_access_requests tar
     LEFT JOIN users u ON u.id = tar.requester_id
     WHERE tar.requester_id = $1
     ORDER BY tar.created_at DESC`,
    [userId]
  );
  return r.rows;
};

/** Incoming — requests TO this user (matched by user id or by phone). */
export const listIncoming = async (
  userId: string,
  userPhone: string | null,
): Promise<TreeAccessRequest[]> => {
  const r = await query<TreeAccessRequest>(
    `SELECT ${REQUEST_COLS}
     FROM tree_access_requests tar
     LEFT JOIN users u ON u.id = tar.requester_id
     WHERE (tar.target_user_id = $1 OR (tar.target_user_id IS NULL AND tar.target_phone = $2))
       AND tar.status = 'pending'
     ORDER BY tar.created_at DESC`,
    [userId, userPhone]
  );
  return r.rows;
};

const getRequest = async (id: string): Promise<TreeAccessRequest> => {
  const r = await query<TreeAccessRequest>(
    `SELECT ${REQUEST_COLS}
     FROM tree_access_requests tar
     LEFT JOIN users u ON u.id = tar.requester_id
     WHERE tar.id = $1`,
    [id]
  );
  if (!r.rows[0]) throw new NotFoundError('Request not found');
  return r.rows[0];
};

/**
 * Accept a pending request. Inserts TWO grant rows — one in each direction —
 * so both users can see each other's trees afterwards.
 */
export const acceptRequest = async (id: string, userId: string): Promise<TreeAccessRequest> => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query<{ requester_id: string; target_user_id: string | null; status: string }>(
      `SELECT requester_id, target_user_id, status FROM tree_access_requests WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const row = r.rows[0];
    if (!row) throw new NotFoundError('Request not found');
    if (row.target_user_id !== userId) throw new BadRequestError('Not your request');
    if (row.status !== 'pending') throw new BadRequestError(`Request already ${row.status}`);
    await c.query(
      `UPDATE tree_access_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [id]
    );
    // Reciprocal grants. ON CONFLICT keeps it idempotent if a grant already
    // exists from a previous request.
    await c.query(
      `INSERT INTO tree_access_grants (user_a_id, user_b_id, request_id)
       VALUES ($1, $2, $3), ($2, $1, $3)
       ON CONFLICT (user_a_id, user_b_id) DO NOTHING`,
      [row.requester_id, userId, id]
    );
    await c.query('COMMIT');
    return await getRequest(id);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};

export const declineRequest = async (id: string, userId: string): Promise<TreeAccessRequest> => {
  const r = await query<{ target_user_id: string | null; status: string }>(
    `SELECT target_user_id, status FROM tree_access_requests WHERE id = $1`,
    [id]
  );
  const row = r.rows[0];
  if (!row) throw new NotFoundError('Request not found');
  if (row.target_user_id !== userId) throw new BadRequestError('Not your request');
  if (row.status !== 'pending') throw new BadRequestError(`Request already ${row.status}`);
  await query(
    `UPDATE tree_access_requests SET status = 'declined', responded_at = NOW() WHERE id = $1`,
    [id]
  );
  return await getRequest(id);
};

export const cancelRequest = async (id: string, userId: string): Promise<TreeAccessRequest> => {
  const r = await query<{ requester_id: string; status: string }>(
    `SELECT requester_id, status FROM tree_access_requests WHERE id = $1`,
    [id]
  );
  const row = r.rows[0];
  if (!row) throw new NotFoundError('Request not found');
  if (row.requester_id !== userId) throw new BadRequestError('Not your request');
  if (row.status !== 'pending') throw new BadRequestError(`Request already ${row.status}`);
  await query(
    `UPDATE tree_access_requests SET status = 'cancelled', responded_at = NOW() WHERE id = $1`,
    [id]
  );
  return await getRequest(id);
};
