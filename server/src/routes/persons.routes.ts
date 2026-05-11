import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, requireTreeOwner } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createPersonSchema } from '../utils/validators.js';
import { listPersons, createPerson, getPerson, updatePerson, deletePerson } from '../services/persons.service.js';

export const personsRoutes = Router({ mergeParams: true });

personsRoutes.use(authenticate, authorizeTree);

// TEMP diagnostic — log every mutation attempt so we can chase
// «Жахонгир can't add parents» style issues. Remove once stable.
const logPersonMutation = (action: 'create' | 'update' | 'delete') => (req: any, res: any, next: any) => {
  const summary = action === 'create'
    ? `firstName='${req.body?.firstName ?? ''}' lastName='${req.body?.lastName ?? ''}' gender='${req.body?.gender ?? ''}'`
    : action === 'update'
      ? `keys=${Object.keys(req.body ?? {}).join(',')}`
      : '';
  console.log(`[persons] ${action} user=${req.user?.id} tree=${req.tree?.id} treeOwner=${req.tree?.userId} readOnly=${req.tree?.readOnly} ${summary}`);
  res.on('finish', () => {
    console.log(`[persons] ${action} → ${res.statusCode} user=${req.user?.id}`);
  });
  next();
};

personsRoutes.get('/', async (req, res, next) => { try { res.json(await listPersons(req.tree!.id)); } catch (e) { next(e); }});
personsRoutes.post('/', requireTreeOwner, logPersonMutation('create'), validate(createPersonSchema), async (req, res, next) => { try { res.status(201).json(await createPerson(req.tree!.id, req.body)); } catch (e) { next(e); }});
personsRoutes.get('/:personId', async (req, res, next) => { try { res.json(await getPerson(req.params.personId)); } catch (e) { next(e); }});
personsRoutes.put('/:personId', requireTreeOwner, logPersonMutation('update'), async (req, res, next) => { try { res.json(await updatePerson(req.params.personId, req.body)); } catch (e) { next(e); }});
personsRoutes.delete('/:personId', requireTreeOwner, logPersonMutation('delete'), async (req, res, next) => { try { await deletePerson(req.params.personId); res.json({ ok: true }); } catch (e) { next(e); }});
