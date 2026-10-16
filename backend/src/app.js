import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config/env.js';
import { csrfProtection } from './middleware/authenticate.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

export function createApp() {
  const app = express();
  if (config.isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  if (config.clientOrigin) {
    app.use(cors({ origin: config.clientOrigin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'] }));
  }
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => {
    const state = mongoose.connection.readyState;
    res.status(state === 1 ? 200 : 503).json({ data: { status: state === 1 ? 'ok' : 'database-unavailable' } });
  });

  app.use('/api', csrfProtection);
  app.use('/api/auth', authRoutes);
  app.use('/api/clinics', clinicRoutes);
  app.use('/api/queue', queueRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', notFound);

  const frontendDist = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
  const frontendIndex = fileURLToPath(new URL('../../frontend/dist/index.html', import.meta.url));
  if (existsSync(frontendIndex)) {
    app.use(express.static(frontendDist, { index: false }));
    app.get('/{*path}', (req, res) => res.sendFile(frontendIndex));
  }

  app.use(errorHandler);
  return app;
}

export default createApp;
