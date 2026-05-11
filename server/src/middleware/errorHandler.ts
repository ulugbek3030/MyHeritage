import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError) {
    // TEMP diagnostic — 400s used to be silent in journalctl. Logging them
    // helps chase user-reported «can't add X» cases.
    console.log(`[err] 400 ${err.code} ${req.method} ${req.originalUrl} details=${JSON.stringify(err.details)} user=${(req as any).user?.id}`);
    return res.status(400).json({ error: err.code, message: err.message, details: err.details });
  }
  if (err instanceof AppError) {
    console.log(`[err] ${err.statusCode} ${err.code} ${req.method} ${req.originalUrl} user=${(req as any).user?.id} msg='${err.message}'`);
    return res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
  console.error('[unhandled]', req.method, req.originalUrl, err);
  return res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
};
