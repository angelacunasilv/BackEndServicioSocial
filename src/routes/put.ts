import { Router } from 'express';
import { actualizarPerfil } from '../controllers/auth';
import { cargarPlantilla, revisar } from '../controllers/documentos';
import { editarInterno, revisarExterno } from '../controllers/programas';
import { editar } from '../controllers/usuarios';
import { requiereRol } from '../http/session';
import { adjuntar } from '../http/upload';

export const putRoutes = Router();
putRoutes.put('/usuarios/:id', requiereRol('ADM'), editar);
putRoutes.put('/alumnos/me/perfil', requiereRol('ALU'), actualizarPerfil);
putRoutes.put('/programas/:id', requiereRol('JSS'), editarInterno);
putRoutes.put('/propuestas/:id/revision', requiereRol('JSS'), revisarExterno);
putRoutes.put('/documentos/:id/revision', requiereRol('JSS'), revisar);
putRoutes.put('/plantillas', requiereRol('JSS'), adjuntar, cargarPlantilla);
