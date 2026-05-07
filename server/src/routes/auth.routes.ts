import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requestOtpSchema, verifyOtpSchema, refreshSchema } from '../utils/validators.js';
import { generateOtp } from '../services/otp.service.js';
import { loginWithOtp, refreshTokens, getMe } from '../services/auth.service.js';

export const authRoutes = Router();

authRoutes.post('/request-otp', validate(requestOtpSchema), async (req, res, next) => {
  try {
    const { ttl } = await generateOtp(req.body.phone);
    res.json({ ok: true, ttl });
  } catch (e) { next(e); }
});

authRoutes.post('/verify-otp', validate(verifyOtpSchema), async (req, res, next) => {
  try { res.json(await loginWithOtp(req.body.phone, req.body.code)); }
  catch (e) { next(e); }
});

authRoutes.post('/refresh', validate(refreshSchema), (req, res, next) => {
  try { res.json(refreshTokens(req.body.refreshToken)); }
  catch (e) { next(e); }
});

authRoutes.post('/logout', (_req, res) => res.json({ ok: true }));

authRoutes.get('/me', authenticate, async (req, res, next) => {
  try { res.json(await getMe(req.user!.id)); }
  catch (e) { next(e); }
});
