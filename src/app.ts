import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { ApiError, errores } from './http/errors';
import { sesiones } from './http/session';
import { deleteRoutes } from './routes/delete';
import { getRoutes } from './routes/get';
import { postRoutes } from './routes/post';
import { putRoutes } from './routes/put';

export const app = express();
const frontend = new URL(env.FRONTEND_URL).origin;
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet({ strictTransportSecurity: env.NODE_ENV === 'production' ? undefined : false }));
app.use((_req, res, next) => {
  const solicitudId = randomUUID();
  res.locals.requestId = solicitudId;
  res.set({ 'X-Request-Id': solicitudId, 'Cache-Control': 'no-store' });
  next();
});
app.use(cors({
  origin: frontend, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  exposedHeaders: ['Location', 'Content-Disposition', 'X-Request-Id'],
}));
app.use((req, _res, next) => {
  const origen = req.get('Origin');
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && origen && origen !== frontend) {
    throw new ApiError(403, 'ORIGEN_NO_AUTORIZADO', 'Origen no autorizado');
  }
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use('/api', sesiones, getRoutes, postRoutes, putRoutes, deleteRoutes);
app.use((_req, _res, next) => next(new ApiError(404, 'RUTA_NO_ENCONTRADA', 'No se encontró la ruta solicitada')));
app.use(errores);
