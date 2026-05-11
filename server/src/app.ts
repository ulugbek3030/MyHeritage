import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { devAuthRoutes } from './routes/dev-auth.routes.js';
import { photoPublicRoutes } from './routes/photo-public.routes.js';
import { treesRoutes } from './routes/trees.routes.js';
import { personsRoutes } from './routes/persons.routes.js';
import { photosRoutes } from './routes/photos.routes.js';
import { relsRoutes } from './routes/relationships.routes.js';
import { eventsRoutes } from './routes/events.routes.js';
import { shareRoutes, sharePublicRoutes } from './routes/share.routes.js';
import { treeAccessRoutes } from './routes/tree-access.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  // TEMP debug bridge: lets the client surface its console.log into server
  // journalctl so we can read it remotely without DevTools access. Remove
  // once autofit drift bug is closed.
  app.post('/api/debug-log', (req, res) => {
    try {
      console.log('[client log]', JSON.stringify(req.body));
    } catch { /* ignore */ }
    res.json({ ok: true });
  });
  app.use('/api/auth', authRoutes);
  if (env.NODE_ENV !== 'production') app.use('/api/auth', devAuthRoutes);
  app.use('/api', photoPublicRoutes);
  app.use('/api', sharePublicRoutes);
  app.use('/api/trees', treesRoutes);
  app.use('/api/trees/:treeId/persons', personsRoutes);
  app.use('/api/trees/:treeId/persons', photosRoutes);
  app.use('/api/trees/:treeId/relationships', relsRoutes);
  app.use('/api/trees/:treeId/events', eventsRoutes);
  app.use('/api/trees/:treeId/share', shareRoutes);
  app.use('/api', treeAccessRoutes);
  app.use(errorHandler);
  return app;
};
