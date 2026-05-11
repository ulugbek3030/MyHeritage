import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, requireTreeOwner } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { enableShare, updateShareSettings, disableShare, getPublicView } from '../services/share.service.js';

const settingsSchema = z.object({ showBirthDates: z.boolean().optional(), showPhotos: z.boolean().optional(), allowSuggestions: z.boolean().optional() });

export const shareRoutes = Router({ mergeParams: true });
shareRoutes.use(authenticate, authorizeTree);

shareRoutes.post('/enable', requireTreeOwner, validate(settingsSchema), async (req, res, next) => { try { res.json(await enableShare(req.tree!.id, req.body)); } catch (e) { next(e); }});
shareRoutes.put('/settings', requireTreeOwner, validate(settingsSchema), async (req, res, next) => { try { res.json(await updateShareSettings(req.tree!.id, req.body)); } catch (e) { next(e); }});
shareRoutes.post('/disable', requireTreeOwner, async (req, res, next) => { try { await disableShare(req.tree!.id); res.json({ ok: true }); } catch (e) { next(e); }});

export const sharePublicRoutes = Router();
sharePublicRoutes.get('/share/:token', async (req, res, next) => {
  try { res.json(await getPublicView(req.params.token)); } catch (e) { next(e); }
});
