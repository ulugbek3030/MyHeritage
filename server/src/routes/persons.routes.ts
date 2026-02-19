import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, TreeRequest } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createPersonSchema, updatePersonSchema } from '../utils/validators.js';
import * as personsService from '../services/persons.service.js';

const router = Router({ mergeParams: true }); // mergeParams for :treeId

// All routes require auth + tree ownership
router.use(authenticate);
router.use(authorizeTree);

// GET /api/trees/:treeId/persons
router.get('/', async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const persons = await personsService.listPersons(req.tree!.id);
    res.json(persons);
  } catch (err) { next(err); }
});

// POST /api/trees/:treeId/persons
router.post('/', validate(createPersonSchema), async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const person = await personsService.createPerson(req.tree!.id, req.body);
    res.status(201).json(person);
  } catch (err) { next(err); }
});

// GET /api/trees/:treeId/persons/:personId
router.get('/:personId', async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const person = await personsService.getPerson(req.tree!.id, req.params.personId as string);
    res.json(person);
  } catch (err) { next(err); }
});

// PUT /api/trees/:treeId/persons/:personId
router.put('/:personId', validate(updatePersonSchema), async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const person = await personsService.updatePerson(req.tree!.id, req.params.personId as string, req.body);
    res.json(person);
  } catch (err) { next(err); }
});

// DELETE /api/trees/:treeId/persons/:personId
router.delete('/:personId', async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const result = await personsService.deletePerson(req.tree!.id, req.params.personId as string);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
