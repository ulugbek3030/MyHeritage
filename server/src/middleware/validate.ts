import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

export const validate = <T>(schema: ZodSchema<T>) => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(new ValidationError(r.error.issues));
  req.body = r.data;
  next();
};
