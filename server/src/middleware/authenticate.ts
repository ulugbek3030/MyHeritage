import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth.js';
import { UnauthorizedError } from '../utils/errors.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    phone: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as { id: string; phone: string };
    req.user = { id: decoded.id, phone: decoded.phone };
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
