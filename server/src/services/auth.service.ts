import { query } from '../db/pool.js';
import { signAccess, signRefresh, verifyRefresh } from '../config/auth.js';
import { UnauthorizedError } from '../utils/errors.js';
import { verifyOtp } from './otp.service.js';
import { fetchClickProfile } from './click.service.js';

// Index signature lets AuthUser satisfy `Record<string, unknown>` — the
// generic constraint on db/pool's `query<T>()` (pg types use that bound).
export interface AuthUser { id: string; phone: string; displayName: string | null; avatarUrl: string | null; [key: string]: unknown; }

export const upsertUserByPhone = async (phone: string): Promise<AuthUser> => {
  const r = await query<AuthUser>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
     RETURNING id, phone, display_name AS "displayName", avatar_url AS "avatarUrl"`,
    [phone]
  );
  return r.rows[0];
};

export const loginWithOtp = async (phone: string, code: string) => {
  const ok = await verifyOtp(phone, code);
  if (!ok) throw new UnauthorizedError('Invalid or expired code');
  const user = await upsertUserByPhone(phone);
  const payload = { sub: user.id, phone: user.phone };
  return { user, accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
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
     RETURNING id, phone, display_name AS "displayName", avatar_url AS "avatarUrl"`,
    [phone, display || null]
  );
  const user = r.rows[0];
  const payload = { sub: user.id, phone: user.phone };
  return { user, accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
};

export const refreshTokens = (token: string) => {
  let payload;
  try { payload = verifyRefresh(token); } catch { throw new UnauthorizedError('Invalid refresh token'); }
  return { accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
};

export const getMe = async (id: string): Promise<AuthUser | null> => {
  const r = await query<AuthUser>(
    `SELECT id, phone, display_name AS "displayName", avatar_url AS "avatarUrl" FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
};
