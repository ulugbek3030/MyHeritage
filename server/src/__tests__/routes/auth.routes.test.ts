import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

describe('POST /api/auth/request-otp + verify-otp', () => {
  it('200 → request, then login with code 0000 in dev', async () => {
    const phone = '+998900000020';
    await request(app).post('/api/auth/request-otp').send({ phone }).expect(200);
    const r = await request(app).post('/api/auth/verify-otp').send({ phone, code: '0000' }).expect(200);
    expect(r.body.user.phone).toBe(phone);
    expect(r.body.accessToken).toMatch(/\./);
  });

  it('400 on invalid phone', async () => {
    await request(app).post('/api/auth/request-otp').send({ phone: 'abc' }).expect(400);
  });

  it('401 on wrong code', async () => {
    const phone = '+998900000021';
    await request(app).post('/api/auth/request-otp').send({ phone });
    await request(app).post('/api/auth/verify-otp').send({ phone, code: '9999' }).expect(401);
  });
});
