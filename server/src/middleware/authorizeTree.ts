import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      tree?: { id: string; userId: string; readOnly: boolean };
    }
  }
}

/**
 * Tree access policy:
 *   1. The tree's owner can do anything → readOnly = false.
 *   2. A user with a `tree_access_grants` row pointing to the tree's
 *      owner can READ the tree (granted via the «Расширить древо» flow)
 *      → readOnly = true. Mutating routes are expected to refuse when
 *      req.tree.readOnly is true (controllers can early-return Forbidden).
 *   3. Anyone else → 403.
 */
/**
 * Hard-stops a request when the caller only has read-only access to the
 * tree (via a `tree_access_grants` row, i.e. «Расширить древо» grantee).
 * Place AFTER `authorizeTree` on every mutating route — POST/PUT/DELETE
 * for persons/relationships/photos/share/etc. — so non-owners can browse
 * a friend's tree but never write to it.
 */
export const requireTreeOwner = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.tree) {
    console.log('[guard] requireTreeOwner: no req.tree set');
    return next(new ForbiddenError('Tree not authorized'));
  }
  if (req.tree.readOnly) {
    // TEMP diagnostic: log every read-only-blocked mutation so we can see who's
    // hitting it and why. Remove once the «Жахонгир can't add parents» case
    // is understood.
    console.log(`[guard] 403 readOnly: user=${req.user?.id} tree=${req.tree.id} treeOwner=${req.tree.userId} ${req.method} ${req.originalUrl}`);
    return next(new ForbiddenError('Read-only access to this tree'));
  }
  return next();
};

export const authorizeTree = async (req: Request, _res: Response, next: NextFunction) => {
  const id = req.params.treeId ?? req.params.id;
  if (!id) return next(new NotFoundError('Tree id required'));
  const r = await query<{ id: string; user_id: string }>(`SELECT id, user_id FROM trees WHERE id = $1`, [id]);
  if (r.rowCount === 0) return next(new NotFoundError('Tree not found'));
  const row = r.rows[0];
  const userId = req.user!.id;
  if (row.user_id === userId) {
    req.tree = { id: row.id, userId: row.user_id, readOnly: false };
    return next();
  }
  // Read-only via tree_access_grants: a → b grant means user a can view
  // user b's tree.
  const g = await query<{ user_b_id: string }>(
    `SELECT user_b_id FROM tree_access_grants WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1`,
    [userId, row.user_id]
  );
  if (g.rowCount && g.rowCount > 0) {
    req.tree = { id: row.id, userId: row.user_id, readOnly: true };
    return next();
  }
  return next(new ForbiddenError('Not your tree'));
};
