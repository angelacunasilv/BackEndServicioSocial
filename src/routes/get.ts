import { Router } from 'express';
import { db } from '../config/database';
import * as auth from '../controllers/auth';
import * as documentos from '../controllers/documentos';
import * as expedientes from '../controllers/expedientes';
import * as programas from '../controllers/programas';
import { reporteFaltantes } from '../controllers/reportes';
import * as usuarios from '../controllers/usuarios';
import { ApiError } from '../http/errors';
import { requiereRol } from '../http/session';

export const getRoutes = Router();
getRoutes.get('/salud', async (_req, res) => {
  try {
    await db.authenticate();
  } catch {
    throw new ApiError(503, 'BASE_NO_DISPONIBLE', 'La base de datos no está disponible');
  }
  res.json({ estado: 'ok' });
});

getRoutes.get('/auth/sesion', requiereRol(), auth.sesion);
getRoutes.get('/usuarios', requiereRol('ADM'), usuarios.listar);
getRoutes.get('/usuarios/:id', requiereRol('ADM'), usuarios.consultar);

getRoutes.get('/alumnos/me/perfil', requiereRol('ALU'), auth.consultarPerfil);
getRoutes.get('/alumnos/me/propuesta', requiereRol('ALU'), programas.propuestaPropia);
getRoutes.get('/alumnos/me/expediente', requiereRol('ALU'), expedientes.mio);

getRoutes.get('/programas', requiereRol('ALU', 'JSS'), programas.banco);
getRoutes.get('/programas/:id', requiereRol('ALU', 'JSS'), programas.consultarInterno);
getRoutes.get('/propuestas', requiereRol('JSS'), programas.listarExternos);
getRoutes.get('/propuestas/:id/archivo', requiereRol('ALU', 'JSS'), programas.descargarExterno);
getRoutes.get('/documentos', requiereRol('JSS'), documentos.listar);
getRoutes.get('/documentos/:id/archivo', requiereRol('ALU', 'JSS', 'JDV'), documentos.descargar);
getRoutes.get('/plantillas', requiereRol('ALU', 'JSS'), documentos.listarPlantillas);
getRoutes.get('/plantillas/:tipo', requiereRol('ALU', 'JSS'), documentos.descargarPlantilla);

getRoutes.get('/reportes/faltantes', requiereRol('JSS'), reporteFaltantes);
getRoutes.get('/expedientes', requiereRol('JDV'), expedientes.consultar);
getRoutes.get('/constancias/:folio/archivo', requiereRol('JDV'), expedientes.descargar);
