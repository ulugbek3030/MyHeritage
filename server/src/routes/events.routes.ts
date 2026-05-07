import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { computeEvents } from '../services/events.service.js';

export const eventsRoutes = Router({ mergeParams: true });
eventsRoutes.use(authenticate, authorizeTree);

eventsRoutes.get('/', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 90 * 86400000);
    res.json(await computeEvents(req.tree!.id, from, to));
  } catch (e) { next(e); }
});
