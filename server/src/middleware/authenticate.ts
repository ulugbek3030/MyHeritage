import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; phone: string };
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new UnauthorizedError('No bearer token'));
  try {
    const payload = jwt.verify(h.slice(7), env.JWT_SECRET) as { sub: string; phone: string };
    req.user = { id: payload.sub, phone: payload.phone };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};
