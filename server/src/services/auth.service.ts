import bcrypt from 'bcrypt';
import { pool, query } from '../db/pool.js';
import { signAccess, signRefresh, verifyRefresh } from '../config/auth.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { verifyOtp } from './otp.service.js';
import { fetchClickProfile, type ClickProfile } from './click.service.js';

// Index signature lets AuthUser satisfy `Record<string, unknown>` — the
// generic constraint on db/pool's `query<T>()` (pg types use that bound).
// Phone is now nullable: email-only signups don't have one.
export interface AuthUser {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  clickClientId: number | null;
  [key: string]: unknown;
}

const BCRYPT_ROUNDS = 12;

const USER_COLS = `id, phone, email, display_name AS "displayName", avatar_url AS "avatarUrl", click_client_id AS "clickClientId"`;

export const upsertUserByPhone = async (phone: string): Promise<AuthUser> => {
  const r = await query<AuthUser>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
     RETURNING ${USER_COLS}`,
    [phone]
  );
  return r.rows[0];
};

const tokensFor = (user: AuthUser) => {
  const payload = {
    sub: user.id,
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.email ? { email: user.email } : {}),
  };
  return { user, accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
};

export const loginWithOtp = async (phone: string, code: string) => {
  const ok = await verifyOtp(phone, code);
  if (!ok) throw new UnauthorizedError('Invalid or expired code');
  const user = await upsertUserByPhone(phone);
  return tokensFor(user);
};

/**
 * Email + password registration. Email is stored as citext so casing on the
 * input doesn't matter. We bcrypt-hash with 12 rounds — plenty for a side-app,
 * cheap enough on a single t-shirt server.
 */
export const registerWithEmail = async (email: string, password: string, displayName?: string) => {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let r;
  try {
    r = await query<AuthUser>(
      `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)
       RETURNING ${USER_COLS}`,
      [email.trim(), hash, displayName?.trim() || null]
    );
  } catch (e) {
    // 23505 = unique_violation on idx_users_email
    if (typeof e === 'object' && e && (e as { code?: string }).code === '23505') {
      throw new ValidationError({ email }, 'Email already registered');
    }
    throw e;
  }
  return tokensFor(r.rows[0]);
};

export const loginWithEmail = async (email: string, password: string) => {
  const r = await query<AuthUser & { password_hash: string | null }>(
    `SELECT ${USER_COLS}, password_hash FROM users WHERE email = $1`,
    [email.trim()]
  );
  const row = r.rows[0];
  // Constant phrasing (no "user not found" / "wrong password" split) so we
  // don't help attackers enumerate registered emails.
  if (!row || !row.password_hash) throw new UnauthorizedError('Invalid email or password');
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throw new UnauthorizedError('Invalid email or password');
  const { password_hash: _omit, ...user } = row;
  void _omit;
  return tokensFor(user as AuthUser);
};

/**
 * First-time-only seeder: when a Click user has no trees yet, create their
 * default tree and an owner person populated from the Click profile (name,
 * surname, patronym, gender, phone). Idempotent — once the user has any
 * tree, this is a no-op so a manually-created tree never gets shadowed by
 * an auto-created one.
 */
const ensureClickUserHasTree = async (userId: string, profile: ClickProfile): Promise<void> => {
  const existing = await query<{ c: string }>(
    'SELECT COUNT(*)::text AS c FROM trees WHERE user_id = $1',
    [userId]
  );
  if (Number(existing.rows[0]?.c ?? 0) > 0) return;

  const surname = String(profile.surname ?? '').trim();
  const firstName = String(profile.name ?? '').trim() || 'Я';
  const patronym = String(profile.patronym ?? '').trim() || null;
  const phone = String(profile.phone_number ?? '').trim() || null;
  // Click sometimes sends gender as 'M'/'F', sometimes as 'male'/'female',
  // sometimes localised. Treat anything that starts with f/ж/Ж as female,
  // everything else as male.
  const gen = String(profile.gender ?? '').trim().toLowerCase();
  const gender: 'male' | 'female' = /^[fж]/.test(gen) ? 'female' : 'male';
  const treeName = surname ? `Семья ${surname}` : 'Моё дерево';

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const t = await c.query<{ id: string }>(
      'INSERT INTO trees (user_id, name) VALUES ($1, $2) RETURNING id',
      [userId, treeName]
    );
    const treeId = t.rows[0].id;
    const p = await c.query<{ id: string }>(
      `INSERT INTO persons (tree_id, first_name, last_name, middle_name, gender, is_alive, verified, phone)
       VALUES ($1, $2, $3, $4, $5, true, true, $6)
       RETURNING id`,
      [treeId, firstName, surname || null, patronym, gender, phone]
    );
    await c.query('UPDATE trees SET owner_person_id = $1 WHERE id = $2', [p.rows[0].id, treeId]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};

/**
 * Exchange a Click web_session for our JWT pair.
 *
 * Lookup priority:
 *   1. click_client_id — Click's permanent ID for this user. Survives phone
 *      number changes, so this is the strongest match if we've seen them
 *      before.
 *   2. phone — for users we onboarded via OTP/legacy before they ever logged
 *      in via Click (or before this column existed). We adopt that row and
 *      stamp click_client_id on it.
 *   3. fresh INSERT.
 *
 * On every call we refresh phone, display_name (only if currently empty) and
 * the cached profile JSON so it's never more than one login stale.
 */
export const loginWithClickSession = async (webSession: string) => {
  const profile = await fetchClickProfile(webSession);
  const clientId = Number(profile.client_id);
  if (!Number.isFinite(clientId) || clientId <= 0) {
    throw new UnauthorizedError('Click profile has no client_id');
  }
  const phone = String(profile.phone_number ?? '').trim() || null;
  const display = [profile.name, profile.surname].filter(Boolean).join(' ').trim() || null;
  const profileJson = JSON.stringify(profile);

  // Try click_client_id first; if that row doesn't exist, fall back to phone.
  // We do an explicit two-step (instead of a single ON CONFLICT) because we
  // need to upgrade legacy phone-only rows by stamping click_client_id on
  // them, and ON CONFLICT can only handle one constraint at a time.
  const byClick = await query<AuthUser>(
    `UPDATE users SET
       phone = COALESCE($2, phone),
       display_name = COALESCE(NULLIF(display_name, ''), $3),
       click_profile = $4::jsonb,
       click_synced_at = NOW(),
       updated_at = NOW()
     WHERE click_client_id = $1
     RETURNING ${USER_COLS}`,
    [clientId, phone, display, profileJson]
  );
  if (byClick.rows[0]) {
    await ensureClickUserHasTree(byClick.rows[0].id, profile);
    return tokensFor(byClick.rows[0]);
  }

  if (phone) {
    const byPhone = await query<AuthUser>(
      `UPDATE users SET
         click_client_id = $1,
         display_name = COALESCE(NULLIF(display_name, ''), $3),
         click_profile = $4::jsonb,
         click_synced_at = NOW(),
         updated_at = NOW()
       WHERE phone = $2
       RETURNING ${USER_COLS}`,
      [clientId, phone, display, profileJson]
    );
    if (byPhone.rows[0]) {
      await ensureClickUserHasTree(byPhone.rows[0].id, profile);
      return tokensFor(byPhone.rows[0]);
    }
  }

  const inserted = await query<AuthUser>(
    `INSERT INTO users (click_client_id, phone, display_name, click_profile, click_synced_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())
     RETURNING ${USER_COLS}`,
    [clientId, phone, display, profileJson]
  );
  await ensureClickUserHasTree(inserted.rows[0].id, profile);
  return tokensFor(inserted.rows[0]);
};

export const refreshTokens = (token: string) => {
  let payload;
  try { payload = verifyRefresh(token); } catch { throw new UnauthorizedError('Invalid refresh token'); }
  return { accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
};

export const getMe = async (id: string): Promise<AuthUser | null> => {
  const r = await query<AuthUser>(
    `SELECT ${USER_COLS} FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
};
