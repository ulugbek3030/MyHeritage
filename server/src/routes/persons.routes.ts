import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, requireTreeOwner } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createPersonSchema } from '../utils/validators.js';
import { listPersons, createPerson, getPerson, updatePerson, deletePerson } from '../services/persons.service.js';

export const personsRoutes = Router({ mergeParams: true });

personsRoutes.use(authenticate, authorizeTree);

personsRoutes.get('/', async (req, res, next) => { try { res.json(await listPersons(req.tree!.id)); } catch (e) { next(e); }});
personsRoutes.post('/', requireTreeOwner, validate(createPersonSchema), async (req, res, next) => { try { res.status(201).json(await createPerson(req.tree!.id, req.body)); } catch (e) { next(e); }});
personsRoutes.get('/:personId', async (req, res, next) => { try { res.json(await getPerson(req.params.personId)); } catch (e) { next(e); }});
personsRoutes.put('/:personId', requireTreeOwner, async (req, res, next) => { try { res.json(await updatePerson(req.params.personId, req.body)); } catch (e) { next(e); }});
personsRoutes.delete('/:personId', requireTreeOwner, async (req, res, next) => { try { await deletePerson(req.params.personId); res.json({ ok: true }); } catch (e) { next(e); }});
