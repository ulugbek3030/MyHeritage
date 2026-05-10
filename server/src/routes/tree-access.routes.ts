import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { query } from '../db/pool.js';
import {
  createRequest,
  listOutgoing,
  listIncoming,
  acceptRequest,
  declineRequest,
  cancelRequest,
  userIsIdentified,
} from '../services/tree-access.service.js';

export const treeAccessRoutes = Router();
treeAccessRoutes.use(authenticate);

// Lightweight status endpoint — UI calls this on modal open to decide
// whether to show the request form or the "go identify yourself" error.
treeAccessRoutes.get('/me/identification-status', async (req, res, next) => {
  try {
    const id = req.user!.id;
    const ok = await userIsIdentified(id);
    res.json({ isIdentified: ok });
  } catch (e) { next(e); }
});

const createSchema = z.object({
  phone: z.string().min(5).max(20),
  message: z.string().max(500).optional(),
});

treeAccessRoutes.post('/tree-access-requests', validate(createSchema), async (req, res, next) => {
  try {
    const r = await createRequest(req.user!.id, req.body.phone, req.body.message ?? null);
    res.status(201).json(r);
  } catch (e) { next(e); }
});

treeAccessRoutes.get('/tree-access-requests/outgoing', async (req, res, next) => {
  try { res.json(await listOutgoing(req.user!.id)); } catch (e) { next(e); }
});

treeAccessRoutes.get('/tree-access-requests/incoming', async (req, res, next) => {
  try {
    // Need the user's own phone to also match requests sent to a phone that
    // didn't yet have a resolved target_user_id at create-time.
    const u = await query<{ phone: string | null }>(`SELECT phone FROM users WHERE id = $1`, [req.user!.id]);
    res.json(await listIncoming(req.user!.id, u.rows[0]?.phone ?? null));
  } catch (e) { next(e); }
});

treeAccessRoutes.post('/tree-access-requests/:id/accept', async (req, res, next) => {
  try { res.json(await acceptRequest(req.params.id, req.user!.id)); } catch (e) { next(e); }
});

treeAccessRoutes.post('/tree-access-requests/:id/decline', async (req, res, next) => {
  try { res.json(await declineRequest(req.params.id, req.user!.id)); } catch (e) { next(e); }
});

treeAccessRoutes.post('/tree-access-requests/:id/cancel', async (req, res, next) => {
  try { res.json(await cancelRequest(req.params.id, req.user!.id)); } catch (e) { next(e); }
});
