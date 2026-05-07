import { query } from '../db/pool.js';
import { env } from '../config/env.js';

export const generateOtp = async (phone: string): Promise<{ code: string; ttl: number }> => {
  const code = env.NODE_ENV === 'production' ? String(Math.floor(1000 + Math.random() * 9000)) : env.OTP_DEV_CODE;
  const ttl = env.OTP_TTL_SECONDS;
  await query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)`,
    [phone, code, ttl]
  );
  if (env.NODE_ENV === 'production') {
    // TODO Phase 2: send via Click SMS or external provider
    console.log(`[otp] would send to ${phone}`);
  } else {
    console.log(`[otp dev] phone=${phone} code=${code}`);
  }
  return { code, ttl };
};

export const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
  const r = await query<{ id: string }>(
    `UPDATE otp_codes SET used_at = NOW()
     WHERE id = (
       SELECT id FROM otp_codes
       WHERE phone = $1 AND code = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING id`,
    [phone, code]
  );
  return r.rowCount > 0;
};
