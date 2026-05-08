import bcrypt from 'bcrypt';
import { query } from '../db/pool.js';
import { signAccess, signRefresh, verifyRefresh } from '../config/auth.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { verifyOtp } from './otp.service.js';
import { fetchClickProfile } from './click.service.js';

// Index signature lets AuthUser satisfy `Record<string, unknown>` — the
// generic constraint on db/pool's `query<T>()` (pg types use that bound).
// Phone is now nullable: email-only signups don't have one.
export interface AuthUser { id: string; phone: string | null; email: string | null; displayName: string | null; avatarUrl: string | null; [key: string]: unknown; }

const BCRYPT_ROUNDS = 12;

const USER_COLS = `id, phone, email, display_name AS "displayName", avatar_url AS "avatarUrl"`;

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
 * Exchange a Click web_session for our JWT pair. Looks up the user by phone
 * (returned by Click), creates one if missing, and stamps display_name with
 * "Name Surname" when the row was new (or empty).
 */
export const loginWithClickSession = async (webSession: string) => {
  const profile = await fetchClickProfile(webSession);
  const phone = String(profile.phone_number ?? '').trim();
  if (!phone) throw new UnauthorizedError('Click profile has no phone_number');
  const display = [profile.name, profile.surname].filter(Boolean).join(' ').trim();
  const r = await query<AuthUser>(
    `INSERT INTO users (phone, display_name) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET
       display_name = COALESCE(NULLIF(users.display_name, ''), EXCLUDED.display_name),
       updated_at = NOW()
     RETURNING ${USER_COLS}`,
    [phone, display || null]
  );
  return tokensFor(r.rows[0]);
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
