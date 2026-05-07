import { Router } from 'express';
import { env } from '../config/env.js';
import { upsertUserByPhone } from '../services/auth.service.js';
import { signAccess, signRefresh } from '../config/auth.js';

export const devAuthRoutes = Router();

devAuthRoutes.post('/dev-login', async (req, res, next) => {
  if (env.NODE_ENV === 'production') return res.status(404).end();
  try {
    const phone = (req.body?.phone as string | undefined) ?? '+998900000001';
    const user = await upsertUserByPhone(phone);
    const payload = { sub: user.id, phone: user.phone };
    res.json({ user, accessToken: signAccess(payload), refreshToken: signRefresh(payload) });
  } catch (e) { next(e); }
});
