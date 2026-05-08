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
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  // Verbose request log for everything except /api/health (which gets pinged
  // every few seconds by the deploy script). Lets us inspect what Click's
  // WebView actually sends — query, cookies, referer, user-agent, custom
  // headers — while we're debugging SSO. Authorization is masked.
  app.use((req, _res, next) => {
    if (req.path === '/api/health') return next();
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const auth = headers.authorization;
    const masked = auth ? (typeof auth === 'string' ? `${auth.slice(0, 10)}…(${auth.length}c)` : '<array>') : '—';
    const clickHeaders = Object.entries(headers)
      .filter(([k]) => k.toLowerCase().includes('click') || k.toLowerCase().startsWith('x-'))
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ') || '—';
    console.log('[req]', req.method, req.originalUrl,
      '\n  query:', JSON.stringify(req.query),
      '\n  cookie:', headers.cookie ?? '—',
      '\n  referer:', headers.referer ?? '—',
      '\n  ua:', String(headers['user-agent'] ?? '').slice(0, 160),
      '\n  authz:', masked,
      '\n  click/x-headers:', clickHeaders);
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
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
  app.use(errorHandler);
  return app;
};
