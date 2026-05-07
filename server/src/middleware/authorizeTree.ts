import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

declare global { namespace Express { interface Request { tree?: { id: string; userId: string } } } }

export const authorizeTree = async (req: Request, _res: Response, next: NextFunction) => {
  const id = req.params.treeId ?? req.params.id;
  if (!id) return next(new NotFoundError('Tree id required'));
  const r = await query<{ id: string; user_id: string }>(`SELECT id, user_id FROM trees WHERE id = $1`, [id]);
  if (r.rowCount === 0) return next(new NotFoundError('Tree not found'));
  if (r.rows[0].user_id !== req.user!.id) return next(new ForbiddenError('Not your tree'));
  req.tree = { id: r.rows[0].id, userId: r.rows[0].user_id };
  next();
};
