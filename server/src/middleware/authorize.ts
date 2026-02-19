import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';
import { query } from '../db/pool.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export interface TreeRequest extends AuthRequest {
  tree?: {
    id: string;
    user_id: string;
    name: string;
    owner_person_id: string | null;
  };
}

export async function authorizeTree(req: TreeRequest, res: Response, next: NextFunction) {
  try {
    const treeId = req.params.treeId || req.params.id;
    if (!treeId) {
      return next(new NotFoundError('Tree'));
    }

    const result = await query('SELECT id, user_id, name, owner_person_id FROM trees WHERE id = $1', [treeId]);

    if (result.rows.length === 0) {
      return next(new NotFoundError('Tree'));
    }

    const tree = result.rows[0];

    if (tree.user_id !== req.user?.id) {
      return next(new ForbiddenError());
    }

    req.tree = tree;
    next();
  } catch (err) {
    next(err);
  }
}
