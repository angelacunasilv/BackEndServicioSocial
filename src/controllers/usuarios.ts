import { Request, Response } from 'express';
import { encontrado } from '../http/errors';
import { Alumnos, Personal, Usuarios } from '../models';
import * as usuarios from '../services/usuarios';
import * as s from '../validation/schemas';
import { lista, vistaUsuario } from '../views/respuestas';

export async function listar(req: Request, res: Response) {
  const { identificador, pagina, limite } = s.buscarUsuario.parse(req.query);
  const filas = await Usuarios.findAndCountAll({
    where: identificador ? { identificador } : undefined,
    attributes: { exclude: ['passwordHash', 'versionSesion'] },
    order: [['id', 'ASC']], limit: limite, offset: (pagina - 1) * limite,
  });
  res.json(lista({ rows: filas.rows.map(vistaUsuario), count: filas.count }, pagina, limite));
}

export async function consultar(req: Request, res: Response) {
  const cuenta = encontrado(await Usuarios.findByPk(s.id.parse(req.params.id), {
    attributes: { exclude: ['passwordHash', 'versionSesion'] },
  }), 'No se encontró el usuario');
  const perfil = cuenta.rol === 'ALU' ? await Alumnos.findByPk(cuenta.id) : await Personal.findByPk(cuenta.id);
  res.json({ datos: { ...vistaUsuario(cuenta), perfil } });
}

export async function crear(req: Request, res: Response) {
  const { usuario, contrasenaInicial } = await usuarios.alta(s.usuarioNuevo.parse(req.body ?? {}));
  res.status(201).location('/api/usuarios/' + usuario.id).json({
    mensaje: 'Acceso creado con éxito', datos: vistaUsuario(usuario), contrasenaInicial,
  });
}

export async function editar(req: Request, res: Response) {
  const cuenta = await usuarios.editar(s.id.parse(req.params.id), s.usuarioEditar.parse(req.body ?? {}));
  res.json({ mensaje: 'Usuario actualizado exitosamente', datos: vistaUsuario(cuenta) });
}

export async function baja(req: Request, res: Response) {
  s.confirmarBaja.parse(req.body ?? {});
  await usuarios.baja(s.id.parse(req.params.id));
  res.json({ mensaje: 'Usuario dado de baja con éxito' });
}
