import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, requireTreeOwner } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createTreeSchema } from '../utils/validators.js';
import { listTrees, createTree, getTree, updateTree, deleteTree, getFullTree } from '../services/trees.service.js';

export const treesRoutes = Router();

treesRoutes.use(authenticate);

treesRoutes.get('/', async (req, res, next) => { try { res.json(await listTrees(req.user!.id)); } catch (e) { next(e); }});

treesRoutes.post('/', validate(createTreeSchema), async (req, res, next) => {
  try { res.status(201).json(await createTree(req.user!.id, req.body.name, req.body.description)); }
  catch (e) { next(e); }
});

treesRoutes.get('/:id', authorizeTree, async (req, res, next) => { try { res.json(await getTree(req.tree!.id)); } catch (e) { next(e); }});

treesRoutes.get('/:id/full', authorizeTree, async (req, res, next) => { try { res.json(await getFullTree(req.tree!.id)); } catch (e) { next(e); }});

treesRoutes.put('/:id', authorizeTree, requireTreeOwner, async (req, res, next) => { try { res.json(await updateTree(req.tree!.id, req.body)); } catch (e) { next(e); }});

treesRoutes.delete('/:id', authorizeTree, requireTreeOwner, async (req, res, next) => { try { await deleteTree(req.tree!.id); res.json({ ok: true }); } catch (e) { next(e); }});
