import { describe, it, expect } from 'vitest';
import { generateOtp } from '../services/otp.service.js';
import { loginWithOtp, refreshTokens } from '../services/auth.service.js';

describe('auth.service', () => {
  it('logs in via valid OTP and returns tokens', async () => {
    const phone = '+998900000010';
    const { code } = await generateOtp(phone);
    const r = await loginWithOtp(phone, code);
    expect(r.user.phone).toBe(phone);
    expect(r.accessToken).toMatch(/\./);
    expect(r.refreshToken).toMatch(/\./);
  });

  it('rejects invalid OTP', async () => {
    await expect(loginWithOtp('+998900000011', '0000')).rejects.toThrow();
  });

  it('refreshes tokens', async () => {
    const phone = '+998900000012';
    const { code } = await generateOtp(phone);
    const r = await loginWithOtp(phone, code);
    const refreshed = refreshTokens(r.refreshToken);
    expect(refreshed.accessToken).toBeTruthy();
  });
});
