import { Router } from 'express';
import { archivarInterno } from '../controllers/programas';
import { baja } from '../controllers/usuarios';
import { requiereRol } from '../http/session';

export const deleteRoutes = Router();
deleteRoutes.delete('/usuarios/:id', requiereRol('ADM'), baja);
deleteRoutes.delete('/programas/:id', requiereRol('JSS'), archivarInterno);
