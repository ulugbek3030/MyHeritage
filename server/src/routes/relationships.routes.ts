import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, requireTreeOwner } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createRelationshipSchema } from '../utils/validators.js';
import { listRels, createRel, getRel, updateRel, deleteRel } from '../services/relationships.service.js';

export const relsRoutes = Router({ mergeParams: true });
relsRoutes.use(authenticate, authorizeTree);

relsRoutes.get('/', async (req, res, next) => { try { res.json(await listRels(req.tree!.id)); } catch (e) { next(e); }});
relsRoutes.post('/', requireTreeOwner, validate(createRelationshipSchema), async (req, res, next) => { try { res.status(201).json(await createRel(req.tree!.id, req.body)); } catch (e) { next(e); }});
relsRoutes.get('/:relId', async (req, res, next) => { try { res.json(await getRel(req.params.relId)); } catch (e) { next(e); }});
relsRoutes.put('/:relId', requireTreeOwner, async (req, res, next) => { try { res.json(await updateRel(req.params.relId, req.body)); } catch (e) { next(e); }});
relsRoutes.delete('/:relId', requireTreeOwner, async (req, res, next) => { try { await deleteRel(req.params.relId); res.json({ ok: true }); } catch (e) { next(e); }});
