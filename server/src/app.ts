import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { treesRoutes } from './routes/trees.routes.js';
import { personsRoutes } from './routes/persons.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/trees', treesRoutes);
  app.use('/api/trees/:treeId/persons', personsRoutes);
  app.use(errorHandler);
  return app;
};
