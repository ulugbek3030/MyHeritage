import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err.message);

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.errors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Unexpected error
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
  });
}
