import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError)
    return res.status(400).json({ error: err.code, message: err.message, details: err.details });
  if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.code, message: err.message });
  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
};
