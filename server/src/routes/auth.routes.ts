import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requestOtpSchema, verifyOtpSchema, refreshSchema, registerSchema, loginEmailSchema } from '../utils/validators.js';
import { generateOtp } from '../services/otp.service.js';
import { loginWithOtp, loginWithClickSession, registerWithEmail, loginWithEmail, refreshTokens, getMe } from '../services/auth.service.js';

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

// Email + password — used when the user opens the app outside Click SuperApp
// (web link, share preview) and isn't returning with a cached JWT.
authRoutes.post('/register', validate(registerSchema), async (req, res, next) => {
  try { res.json(await registerWithEmail(req.body.email, req.body.password, req.body.displayName)); }
  catch (e) { next(e); }
});

authRoutes.post('/login', validate(loginEmailSchema), async (req, res, next) => {
  try { res.json(await loginWithEmail(req.body.email, req.body.password)); }
  catch (e) { next(e); }
});

// Click SuperApp single-sign-on. The mini-app receives `web_session` from the
// Click webview (typically as a query param) and exchanges it here for our
// JWT pair. See server/src/services/click.service.ts for the request shape.
authRoutes.post('/click-session', async (req, res, next) => {
  try {
    const ws = String(req.body?.web_session ?? req.body?.webSession ?? '').trim();
    if (!ws) { res.status(400).json({ error: 'web_session is required' }); return; }
    // Cookies forwarded from the browser (Click sets several alongside
    // web_session, and some carry KYC / profile data not in the integration
    // API response).
    const cookies = (req.body?.cookies && typeof req.body.cookies === 'object')
      ? (req.body.cookies as Record<string, string>)
      : undefined;
    res.json(await loginWithClickSession(ws, cookies));
  } catch (e) { next(e); }
});

authRoutes.post('/logout', (_req, res) => res.json({ ok: true }));

authRoutes.get('/me', authenticate, async (req, res, next) => {
  try { res.json(await getMe(req.user!.id)); }
  catch (e) { next(e); }
});
