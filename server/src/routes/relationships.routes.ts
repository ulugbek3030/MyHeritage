import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, requireTreeOwner } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createRelationshipSchema } from '../utils/validators.js';
import { listRels, createRel, getRel, updateRel, deleteRel } from '../services/relationships.service.js';

export const relsRoutes = Router({ mergeParams: true });
relsRoutes.use(authenticate, authorizeTree);

// TEMP diagnostic — same shape as in persons.routes.ts.
const logRelMutation = (action: 'create' | 'update' | 'delete') => (req: any, res: any, next: any) => {
  const summary = action === 'create'
    ? `type=${req.body?.type} p1=${req.body?.person1Id} p2=${req.body?.person2Id}`
    : action === 'update'
      ? `keys=${Object.keys(req.body ?? {}).join(',')}`
      : `relId=${req.params?.relId}`;
  console.log(`[rels] ${action} user=${req.user?.id} tree=${req.tree?.id} treeOwner=${req.tree?.userId} readOnly=${req.tree?.readOnly} ${summary}`);
  res.on('finish', () => {
    console.log(`[rels] ${action} → ${res.statusCode} user=${req.user?.id}`);
  });
  next();
};

relsRoutes.get('/', async (req, res, next) => { try { res.json(await listRels(req.tree!.id)); } catch (e) { next(e); }});
relsRoutes.post('/', requireTreeOwner, logRelMutation('create'), validate(createRelationshipSchema), async (req, res, next) => { try { res.status(201).json(await createRel(req.tree!.id, req.body)); } catch (e) { next(e); }});
relsRoutes.get('/:relId', async (req, res, next) => { try { res.json(await getRel(req.params.relId)); } catch (e) { next(e); }});
relsRoutes.put('/:relId', requireTreeOwner, logRelMutation('update'), async (req, res, next) => { try { res.json(await updateRel(req.params.relId, req.body)); } catch (e) { next(e); }});
relsRoutes.delete('/:relId', requireTreeOwner, logRelMutation('delete'), async (req, res, next) => { try { await deleteRel(req.params.relId); res.json({ ok: true }); } catch (e) { next(e); }});
