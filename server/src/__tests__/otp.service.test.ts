import { describe, it, expect } from 'vitest';
import { generateOtp, verifyOtp } from '../services/otp.service.js';

describe('otp.service', () => {
  it('generates a code and verifies it', async () => {
    const { code } = await generateOtp('+998901234567');
    const ok = await verifyOtp('+998901234567', code);
    expect(ok).toBe(true);
  });

  it('rejects already-used code', async () => {
    const { code } = await generateOtp('+998900000001');
    expect(await verifyOtp('+998900000001', code)).toBe(true);
    expect(await verifyOtp('+998900000001', code)).toBe(false);
  });

  it('rejects wrong code', async () => {
    await generateOtp('+998900000002');
    expect(await verifyOtp('+998900000002', '9999')).toBe(false);
  });
});
