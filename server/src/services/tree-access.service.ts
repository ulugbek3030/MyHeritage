import type { PoolClient } from 'pg';
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

/** Strip the "+" prefix so we can compare phones across rows that may or may
 *  not have one. SQL helper used in the request lookups so a sender writing
 *  "+998..." finds a recipient whose users.phone happens to be "998..." (or
 *  vice versa). */
const phoneSansPlus = (raw: string): string => raw.replace(/^\++/, '');

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
  // Click KYC gate temporarily disabled — re-enable by re-introducing
  // `if (!await userIsIdentified(requesterId)) throw new BadRequestError('not_identified');`
  // once Click's is_identified flag is reliably populated on every user.
  const phone = normalisePhone(rawPhone);
  if (!/^\+?\d{9,15}$/.test(phone)) {
    throw new BadRequestError('Invalid phone format');
  }
  // Look up the target user — they may not exist yet, in which case we
  // store the request with target_user_id = NULL and reconcile when they
  // first sign in (TODO). Match phones tolerantly: stored users.phone may
  // or may not have a leading "+" depending on which path created the row.
  const noPlus = phoneSansPlus(phone);
  const t = await query<{ id: string; phone: string | null }>(
    `SELECT id, phone FROM users
     WHERE phone = $1
        OR phone = $2
        OR regexp_replace(COALESCE(phone, ''), '^\\+', '') = $2
        OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2
        -- Click sometimes omits phone_number for non-identified users
        -- so users.phone is NULL even though the JSONB blob has it.
        -- Fall back to matching against the cached profile phone too.
        OR regexp_replace(COALESCE(click_profile->>'phone_number', ''), '[^0-9]', '', 'g') = $2
     LIMIT 1`,
    [phone, noPlus]
  );
  const targetUserId = t.rows[0]?.id ?? null;
  // TEMP debug: log every request creation so we can verify the lookup
  // is finding the right recipient. Remove once the flow is stable.
  console.log('[tar create] requester=%s rawPhone=%o normalised=%o noPlus=%o target=%s targetPhone=%o',
    requesterId, rawPhone, phone, noPlus, targetUserId ?? 'NULL', t.rows[0]?.phone ?? null);
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

/** Incoming — requests TO this user (matched by user id or by phone).
 *  Phone matching is tolerant: target_phone in the request might or might
 *  not have a "+" prefix vs. the user's stored phone. */
export const listIncoming = async (
  userId: string,
  userPhone: string | null,
): Promise<TreeAccessRequest[]> => {
  const phoneWithPlus = userPhone ? (userPhone.startsWith('+') ? userPhone : `+${userPhone.replace(/^\++/, '')}`) : null;
  const phoneNoPlus = userPhone ? userPhone.replace(/^\++/, '').replace(/[^0-9]/g, '') : null;
  const r = await query<TreeAccessRequest>(
    `SELECT ${REQUEST_COLS}
     FROM tree_access_requests tar
     LEFT JOIN users u ON u.id = tar.requester_id
     WHERE (
       tar.target_user_id = $1
       OR (
         tar.target_phone = $2
         OR tar.target_phone = $3
         OR regexp_replace(tar.target_phone, '^\\+', '') = $3
         OR regexp_replace(tar.target_phone, '[^0-9]', '', 'g') = $3
       )
     )
     AND tar.status = 'pending'
     ORDER BY tar.created_at DESC`,
    [userId, phoneWithPlus, phoneNoPlus]
  );
  // TEMP debug — log every poll so we can see whether the recipient's
  // phone matching is reaching anything. Remove once stable.
  console.log('[tar incoming] user=%s userPhone=%o noPlus=%o → %d rows',
    userId, phoneWithPlus, phoneNoPlus, r.rows.length);
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
 * Whether the given user is allowed to act on (accept / decline) a request.
 * Either they ARE the target_user_id, OR target_user_id is NULL and their
 * phone matches the request's target_phone (covers the case where the
 * recipient hadn't yet existed / had no phone at create time).
 */
const userOwnsRequest = async (
  client: PoolClient,
  requestId: string,
  userId: string,
): Promise<{
  ok: boolean;
  requesterId: string;
  status: string;
  targetUserId: string | null;
}> => {
  const r = await client.query<{
    requester_id: string;
    target_user_id: string | null;
    target_phone: string;
    status: string;
  }>(
    `SELECT requester_id, target_user_id, target_phone, status
     FROM tree_access_requests WHERE id = $1 FOR UPDATE`,
    [requestId]
  );
  const row = r.rows[0];
  if (!row) return { ok: false, requesterId: '', status: '', targetUserId: null };
  if (row.target_user_id === userId) {
    return { ok: true, requesterId: row.requester_id, status: row.status, targetUserId: row.target_user_id };
  }
  if (row.target_user_id === null) {
    const tp = row.target_phone;
    const tpNoPlus = tp.replace(/^\++/, '').replace(/[^0-9]/g, '');
    const u = await client.query<{ id: string }>(
      `SELECT id FROM users
       WHERE id = $1
         AND (
           phone = $2
           OR phone = $3
           OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $3
           OR regexp_replace(COALESCE(click_profile->>'phone_number', ''), '[^0-9]', '', 'g') = $3
         )
       LIMIT 1`,
      [userId, tp, tpNoPlus]
    );
    if (u.rows[0]) {
      return { ok: true, requesterId: row.requester_id, status: row.status, targetUserId: row.target_user_id };
    }
  }
  return { ok: false, requesterId: row.requester_id, status: row.status, targetUserId: row.target_user_id };
};

/**
 * Accept a pending request. Inserts TWO grant rows — one in each direction —
 * so both users can see each other's trees afterwards.
 */
export const acceptRequest = async (id: string, userId: string): Promise<TreeAccessRequest> => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const own = await userOwnsRequest(c, id, userId);
    if (!own.ok && !own.requesterId) throw new NotFoundError('Request not found');
    if (!own.ok) throw new BadRequestError('Not your request');
    if (own.status !== 'pending') throw new BadRequestError(`Request already ${own.status}`);
    // Stamp target_user_id while accepting if it was NULL — keeps the row
    // canonical for future status queries / list filters.
    await c.query(
      `UPDATE tree_access_requests
       SET status = 'accepted', responded_at = NOW(),
           target_user_id = COALESCE(target_user_id, $2)
       WHERE id = $1`,
      [id, userId]
    );
    // Reciprocal grants. ON CONFLICT keeps it idempotent if a grant already
    // exists from a previous request.
    await c.query(
      `INSERT INTO tree_access_grants (user_a_id, user_b_id, request_id)
       VALUES ($1, $2, $3), ($2, $1, $3)
       ON CONFLICT (user_a_id, user_b_id) DO NOTHING`,
      [own.requesterId, userId, id]
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
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const own = await userOwnsRequest(c, id, userId);
    if (!own.ok && !own.requesterId) throw new NotFoundError('Request not found');
    if (!own.ok) throw new BadRequestError('Not your request');
    if (own.status !== 'pending') throw new BadRequestError(`Request already ${own.status}`);
    await c.query(
      `UPDATE tree_access_requests
       SET status = 'declined', responded_at = NOW(),
           target_user_id = COALESCE(target_user_id, $2)
       WHERE id = $1`,
      [id, userId]
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
