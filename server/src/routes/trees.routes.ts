import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { authorizeTree, TreeRequest } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createTreeSchema, updateTreeSchema } from '../utils/validators.js';
import * as treesService from '../services/trees.service.js';

const router = Router();

// All routes require auth
router.use(authenticate);

// GET /api/trees
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trees = await treesService.listTrees(req.user!.id);
    res.json(trees);
  } catch (err) { next(err); }
});

// POST /api/trees
router.post('/', validate(createTreeSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tree = await treesService.createTree(req.user!.id, req.body.name, req.body.description);
    res.status(201).json(tree);
  } catch (err) { next(err); }
});

// GET /api/trees/:id
router.get('/:id', authorizeTree, async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    res.json(req.tree);
  } catch (err) { next(err); }
});

// PUT /api/trees/:id
router.put('/:id', authorizeTree, validate(updateTreeSchema), async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const tree = await treesService.updateTree(req.tree!.id, req.body);
    res.json(tree);
  } catch (err) { next(err); }
});

// DELETE /api/trees/:id
router.delete('/:id', authorizeTree, async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const result = await treesService.deleteTree(req.tree!.id);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/trees/:id/full — full tree for rendering
router.get('/:id/full', authorizeTree, async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const fullTree = await treesService.getFullTree(req.tree!.id);
    res.json(fullTree);
  } catch (err) { next(err); }
});

export default router;
