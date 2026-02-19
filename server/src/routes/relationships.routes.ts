import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, TreeRequest } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createRelationshipSchema, updateRelationshipSchema } from '../utils/validators.js';
import * as relService from '../services/relationships.service.js';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(authorizeTree);

// GET /api/trees/:treeId/relationships
router.get('/', async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const rels = await relService.listRelationships(req.tree!.id);
    res.json(rels);
  } catch (err) { next(err); }
});

// POST /api/trees/:treeId/relationships
router.post('/', validate(createRelationshipSchema), async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const rel = await relService.createRelationship(req.tree!.id, req.body);
    res.status(201).json(rel);
  } catch (err) { next(err); }
});

// PUT /api/trees/:treeId/relationships/:relId
router.put('/:relId', validate(updateRelationshipSchema), async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const rel = await relService.updateRelationship(req.tree!.id, req.params.relId as string, req.body);
    res.json(rel);
  } catch (err) { next(err); }
});

// DELETE /api/trees/:treeId/relationships/:relId
router.delete('/:relId', async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const result = await relService.deleteRelationship(req.tree!.id, req.params.relId as string);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
