import { Router } from 'express';
import { getPhoto } from '../services/photos.service.js';

export const photoPublicRoutes = Router();

photoPublicRoutes.get('/trees/:treeId/persons/:personId/photo', async (req, res, next) => {
  try {
    const photo = await getPhoto(req.params.personId);
    if (!photo) return res.status(404).end();
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(photo.data);
  } catch (e) { next(e); }
});
