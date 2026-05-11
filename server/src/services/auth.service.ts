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
  isIdentified?: boolean;
  [key: string]: unknown;
}

const BCRYPT_ROUNDS = 12;

const USER_COLS = `id, phone, email, display_name AS "displayName", avatar_url AS "avatarUrl", click_client_id AS "clickClientId", is_identified AS "isIdentified"`;

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
 * First-login seeder: makes sure a Click user is represented as a person in
 * a tree of their own. Idempotent on persons (not on trees) — if the user
 * already manually created an empty tree before this seeder shipped, we
 * adopt that tree and drop the owner person into it instead of creating a
 * second tree alongside it.
 *
 * Skip condition: user already has ≥1 person across all their trees.
 */
const ensureClickUserHasOwnerPerson = async (userId: string, profile: ClickProfile): Promise<void> => {
  // Skip ONLY when the user already has a tree with an owner_person_id
  // pointing at a real person. The previous "any person at all" check was
  // wrong: if the user deleted their own card but still had relatives in
  // the tree, count > 0 and the seeder bailed, leaving owner_person_id
  // null and breaking everything that needs the owner (auto-fit, lineage,
  // hero, etc.).
  const ownerCheck = await query<{ owner_person_id: string | null; tree_id: string }>(
    `SELECT t.owner_person_id, t.id AS tree_id
     FROM trees t
     LEFT JOIN persons p ON p.id = t.owner_person_id
     WHERE t.user_id = $1
     ORDER BY t.created_at
     LIMIT 1`,
    [userId]
  );
  const existingTreeRow = ownerCheck.rows[0];
  if (existingTreeRow && existingTreeRow.owner_person_id) {
    // Real owner still alive — nothing to do.
    return;
  }

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
    // Serialize concurrent seeders for the same user. Without this two
    // simultaneous Click SSO requests can both pass the existing-persons
    // check, both fall through to INSERT, and end up creating two trees
    // ('Семья Abdukadirov' twice) before either can commit.
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cf-seed:${userId}`]);
    // Re-check inside the lock — by the time we got here someone else may
    // have already finished the seed. Same "owner present" check as above.
    const ownerAgain = await c.query<{ owner_person_id: string | null }>(
      `SELECT t.owner_person_id
       FROM trees t LEFT JOIN persons p ON p.id = t.owner_person_id
       WHERE t.user_id = $1
       ORDER BY t.created_at LIMIT 1`,
      [userId]
    );
    if (ownerAgain.rows[0] && ownerAgain.rows[0].owner_person_id) {
      await c.query('COMMIT');
      return;
    }
    // Prefer an existing tree (oldest) so we don't fork a user who already
    // tapped "Создать" before this seeder existed. Only insert a new one if
    // they truly have nothing yet.
    const existingTree = await c.query<{ id: string }>(
      'SELECT id FROM trees WHERE user_id = $1 ORDER BY created_at LIMIT 1',
      [userId]
    );
    let treeId: string;
    if (existingTree.rows[0]) {
      treeId = existingTree.rows[0].id;
    } else {
      const t = await c.query<{ id: string }>(
        'INSERT INTO trees (user_id, name) VALUES ($1, $2) RETURNING id',
        [userId, treeName]
      );
      treeId = t.rows[0].id;
    }
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
/**
 * Look for the KYC flag in Click's browser cookies. Click can set a profile
 * cookie (URL-encoded JSON) named `click-user-data`, `click-data`, or similar
 * alongside `click-web-session`. We scan every cookie value, try to decode +
 * parse as JSON, and pull out is_identified when we find it.
 *
 * Returns `true` / `false` if a value was found, `null` if no cookie had the
 * flag (caller falls back to the integration API profile).
 */
const isIdentifiedFromCookies = (cookies?: Record<string, string>): boolean | null => {
  if (!cookies) return null;
  // Quick scan: any cookie value that, when decoded + parsed as JSON,
  // contains an is_identified field.
  for (const [name, raw] of Object.entries(cookies)) {
    if (!raw) continue;
    // Decode URL-encoded chunks first; many web apps store profile JSON in
    // cookies as encodeURIComponent(JSON.stringify(...)).
    let decoded = raw;
    try { decoded = decodeURIComponent(raw); } catch { /* ignore */ }
    if (!decoded.includes('is_identified') && !decoded.includes('isIdentified')) continue;
    try {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === 'object') {
        const v = (parsed as Record<string, unknown>).is_identified
          ?? (parsed as Record<string, unknown>).isIdentified;
        if (v === true || v === 'true' || v === 1 || v === '1') {
          console.log('[click sso] is_identified=true from cookie "%s"', name);
          return true;
        }
        if (v === false || v === 'false' || v === 0 || v === '0') {
          console.log('[click sso] is_identified=false from cookie "%s"', name);
          return false;
        }
      }
    } catch { /* not JSON, ignore */ }
  }
  return null;
};

export const loginWithClickSession = async (
  webSession: string,
  cookies?: Record<string, string>,
) => {
  const profile = await fetchClickProfile(webSession);
  const clientId = Number(profile.client_id);
  if (!Number.isFinite(clientId) || clientId <= 0) {
    throw new UnauthorizedError('Click profile has no client_id');
  }
  const phone = String(profile.phone_number ?? '').trim() || null;
  const display = [profile.name, profile.surname].filter(Boolean).join(' ').trim() || null;
  const profileJson = JSON.stringify(profile);
  // KYC flag: prefer Click's cookie value (the integration API often omits
  // is_identified), fall back to the profile field. Missing in both →
  // treat as false.
  const fromCookies = isIdentifiedFromCookies(cookies);
  const isIdentified =
    fromCookies !== null ? fromCookies : profile.is_identified === true;
  // TEMP debug — keep until verified end-to-end.
  console.log(
    '[click sso] click_id=%s is_identified=%o (api_field=%o cookie_keys=%o)',
    clientId,
    isIdentified,
    profile.is_identified,
    cookies ? Object.keys(cookies) : null,
  );

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
       is_identified = $5,
       updated_at = NOW()
     WHERE click_client_id = $1
     RETURNING ${USER_COLS}`,
    [clientId, phone, display, profileJson, isIdentified]
  );
  if (byClick.rows[0]) {
    await ensureClickUserHasOwnerPerson(byClick.rows[0].id, profile);
    return tokensFor(byClick.rows[0]);
  }

  if (phone) {
    const byPhone = await query<AuthUser>(
      `UPDATE users SET
         click_client_id = $1,
         display_name = COALESCE(NULLIF(display_name, ''), $3),
         click_profile = $4::jsonb,
         click_synced_at = NOW(),
         is_identified = $5,
         updated_at = NOW()
       WHERE phone = $2
       RETURNING ${USER_COLS}`,
      [clientId, phone, display, profileJson, isIdentified]
    );
    if (byPhone.rows[0]) {
      await ensureClickUserHasOwnerPerson(byPhone.rows[0].id, profile);
      return tokensFor(byPhone.rows[0]);
    }
  }

  const inserted = await query<AuthUser>(
    `INSERT INTO users (click_client_id, phone, display_name, click_profile, click_synced_at, is_identified)
     VALUES ($1, $2, $3, $4::jsonb, NOW(), $5)
     RETURNING ${USER_COLS}`,
    [clientId, phone, display, profileJson, isIdentified]
  );
  await ensureClickUserHasOwnerPerson(inserted.rows[0].id, profile);
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
