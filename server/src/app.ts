import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { errorHandler, notFound } from './errors.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './modules/auth.js';
import { surveysRouter } from './modules/surveys.js';
import { responsesRouter } from './modules/responses.js';
import { analyticsRouter } from './modules/analytics.js';
import { leadersRouter } from './modules/leaders.js';
import { alertsRouter } from './modules/alerts.js';
import { configRouter, riskRouter } from './modules/config.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60_000, limit: env.isTest ? 100000 : 300, standardHeaders: true, legacyHeaders: false,
    message: { error: { code: 'DEMASIADAS_SOLICITUDES', message: 'Hiciste muchas solicitudes seguidas. Espera un minuto e inténtalo de nuevo.' } } }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);

  const api = express.Router();
  api.use(requireAuth);
  api.use('/surveys', surveysRouter);
  api.use('/', responsesRouter);
  api.use('/analytics', analyticsRouter);
  api.use('/leaders', leadersRouter);
  api.use('/alerts', alertsRouter);
  api.use('/config', configRouter);
  api.use('/risk', riskRouter);
  app.use('/api', api);

  app.use('/api', (_req, _res, next) => next(notFound('Esa ruta no existe en la API. Revisa la dirección.')));
  app.use(errorHandler);
  return app;
}
