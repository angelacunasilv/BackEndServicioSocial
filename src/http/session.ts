import { Request, RequestHandler, Response } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { env } from '../config/env';
import { connection } from '../config/database';
import { Rol } from '../config/constants';
import { Usuario, Usuarios } from '../models';
import { tokenAleatorio, tokensIguales } from '../services/crypto';
import { ApiError } from './errors';

declare module 'express-session' {
  interface SessionData {
    usuarioId?: number;
    versionSesion?: number;
    csrfToken?: string;
  }
}
declare global {
  namespace Express {
    interface Request { usuario?: Usuario; }
  }
}

const cookieName = env.NODE_ENV === 'production' ? '__Host-servicio.sid' : 'servicio.sid';
const cookie = {
  path: '/', httpOnly: true, sameSite: 'lax' as const, secure: env.NODE_ENV === 'production',
};
const PgStore = connectPgSimple(session);
export const store = new PgStore({
  conObject: { ...connection, connectionTimeoutMillis: 2000, statement_timeout: 2500 },
  tableName: 'sesiones',
  errorLog: () => console.error('Error en el almacén de sesiones'),
});

export const sesiones = session({
  name: cookieName,
  secret: env.SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: false,
  cookie: { ...cookie, maxAge: 8 * 60 * 60 * 1000 },
});

export async function iniciarSesion(req: Request, usuario: Usuario) {
  await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.usuarioId = usuario.id;
  req.session.versionSesion = usuario.versionSesion;
  req.session.csrfToken = tokenAleatorio();
  await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
  return req.session.csrfToken;
}

export async function cerrarSesion(req: Request, res: Response) {
  await new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  res.clearCookie(cookieName, cookie);
}

export const requiereRol = (...roles: Rol[]): RequestHandler => async (req, _res, next) => {
  const usuario = req.session.usuarioId ? await Usuarios.findByPk(req.session.usuarioId, {
    attributes: { exclude: ['passwordHash'] },
  }) : null;
  if (!usuario?.activo || usuario.versionSesion !== req.session.versionSesion) {
    throw new ApiError(401, 'SESION_REQUERIDA', 'Inicie sesión');
  }
  if (roles.length && !roles.includes(usuario.rol)) {
    throw new ApiError(403, 'ROL_NO_AUTORIZADO', 'Su rol no tiene acceso a esta operación');
  }
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const token = req.get('X-CSRF-Token');
    if (!token || !req.session.csrfToken || !tokensIguales(token, req.session.csrfToken)) {
      throw new ApiError(403, 'CSRF_INVALIDO', 'El token de seguridad de la sesión es inválido');
    }
  }
  req.usuario = usuario.get({ plain: true });
  next();
};
