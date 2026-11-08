import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as auth from '../controllers/auth';
import { subir } from '../controllers/documentos';
import { emitir } from '../controllers/expedientes';
import { cargar } from '../controllers/induccion';
import * as programas from '../controllers/programas';
import { crear } from '../controllers/usuarios';
import { ApiError } from '../http/errors';
import { requiereRol } from '../http/session';
import { adjuntar } from '../http/upload';

function limitar(limit: number, windowMs: number) {
  return rateLimit({
    limit, windowMs, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'DEMASIADAS_SOLICITUDES', 'Intente nuevamente más tarde')),
  });
}

export const postRoutes = Router();
postRoutes.post('/auth/login', limitar(30, 5 * 60_000), auth.login);
postRoutes.post('/auth/recuperar', limitar(10, 15 * 60_000), auth.recuperar);
postRoutes.post('/auth/restablecer', limitar(15, 15 * 60_000), auth.restablecer);
postRoutes.post('/auth/logout', requiereRol(), auth.logout);

postRoutes.post('/usuarios', requiereRol('ADM'), crear);
postRoutes.post('/induccion/asistencias', requiereRol('JSS'), adjuntar, cargar);
postRoutes.post('/programas', requiereRol('JSS'), programas.crearInterno);
postRoutes.post('/alumnos/me/seleccion', requiereRol('ALU'), programas.seleccionar);
postRoutes.post('/alumnos/me/propuesta', requiereRol('ALU'), adjuntar, programas.crearExterno);
postRoutes.post('/documentos', requiereRol('ALU'), adjuntar, subir);
postRoutes.post('/constancias', requiereRol('JDV'), emitir);
