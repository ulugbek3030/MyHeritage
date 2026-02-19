import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { registerSchema, loginSchema } from '../utils/validators.js';
import * as authService from '../services/auth.service.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, displayName } = req.body;
    const result = await authService.registerUser(email, password, displayName);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

export default router;
