import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// In production (compiled), __dirname = server/dist
// .env lives at server/.env (one level up from dist)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import treesRoutes from './routes/trees.routes.js';
import personsRoutes from './routes/persons.routes.js';
import relationshipsRoutes from './routes/relationships.routes.js';
import photosRoutes from './routes/photos.routes.js';
import * as photosService from './services/photos.service.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // In production, same-origin requests have no origin header
    if (!origin) return callback(null, true);
    // Allow any localhost in development
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    // Allow configured client URL
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) return callback(null, true);
    // In production, allow same origin (Cloud Run serves both API and client)
    if (isProduction) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// Public endpoint: serve photos without auth (needed for <img src="...">)
// Must be BEFORE treesRoutes which applies authenticate middleware to all /api/trees/*
app.get('/api/trees/:treeId/persons/:personId/photo', async (req, res, next) => {
  try {
    const photo = await photosService.getPhoto(req.params.treeId, req.params.personId);
    if (!photo) return res.status(404).json({ error: 'No photo' });
    res.set('Content-Type', photo.mime);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(photo.data);
  } catch (err) { next(err); }
});

// Routes (all require auth)
app.use('/api/auth', authRoutes);
app.use('/api/trees', treesRoutes);
app.use('/api/trees/:treeId/persons', photosRoutes);
app.use('/api/trees/:treeId/persons', personsRoutes);
app.use('/api/trees/:treeId/relationships', relationshipsRoutes);

// ── Production: serve React client ──────────────────────
if (isProduction) {
  // client/dist is at ../../client/dist relative to server/dist/
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback: any non-API GET → index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
