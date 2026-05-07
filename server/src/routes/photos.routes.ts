import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { setPhoto, deletePhoto } from '../services/photos.service.js';
import { ValidationError } from '../utils/errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    if (!['image/jpeg','image/png','image/webp'].includes(f.mimetype)) return cb(new ValidationError({ mime: f.mimetype }, 'Unsupported image type'));
    cb(null, true);
  },
});

export const photosRoutes = Router({ mergeParams: true });
photosRoutes.use(authenticate, authorizeTree);

photosRoutes.post('/:personId/photo', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError({}, 'photo file required');
    await setPhoto(req.params.personId, req.file.buffer, req.file.mimetype);
    res.json({ ok: true, photoUrl: `/api/trees/${req.tree!.id}/persons/${req.params.personId}/photo` });
  } catch (e) { next(e); }
});

photosRoutes.delete('/:personId/photo', async (req, res, next) => {
  try { await deletePhoto(req.params.personId); res.json({ ok: true }); } catch (e) { next(e); }
});
