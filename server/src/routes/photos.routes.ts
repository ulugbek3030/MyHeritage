import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'os';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree, TreeRequest } from '../middleware/authorize.js';
import { ValidationError } from '../utils/errors.js';
import * as photosService from '../services/photos.service.js';

const upload = multer({
  dest: os.tmpdir(), // Use OS temp dir (works on any host, no filesystem dependency)
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only JPEG, PNG, WebP images allowed') as any);
    }
  },
});

const router = Router({ mergeParams: true });

// GET photo — public (no auth required), serves binary from DB
// Must be BEFORE authenticate middleware
router.get('/:personId/photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const treeId = req.params.treeId as string;
    const personId = req.params.personId as string;
    const photo = await photosService.getPhoto(treeId, personId);

    if (!photo) {
      return res.status(404).json({ error: 'No photo' });
    }

    res.set('Content-Type', photo.mime);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(photo.data);
  } catch (err) { next(err); }
});

// Auth required for upload/delete
router.use(authenticate);
router.use(authorizeTree);

// POST /api/trees/:treeId/persons/:personId/photo
router.post('/:personId/photo', upload.single('photo'), async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('No file uploaded');
    const result = await photosService.uploadPhoto(req.tree!.id, req.params.personId as string, req.file);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /api/trees/:treeId/persons/:personId/photo
router.delete('/:personId/photo', async (req: TreeRequest, res: Response, next: NextFunction) => {
  try {
    const result = await photosService.deletePhoto(req.tree!.id, req.params.personId as string);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
