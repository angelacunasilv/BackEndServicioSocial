import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { db } from '../config/database';
import { ApiError, encontrado } from '../http/errors';
import { cerrarSesion, iniciarSesion } from '../http/session';
import { Alumnos, Recuperaciones, Usuarios } from '../models';
import { enviarRecuperacion } from '../services/correo';
import { hashPassword, hashToken, passwordCorrecta, tokenAleatorio } from '../services/crypto';
import * as s from '../validation/schemas';
import { vistaUsuario } from '../views/respuestas';

export async function login(req: Request, res: Response) {
  const { identificador, contrasena } = s.login.parse(req.body ?? {});
  const usuario = await Usuarios.findOne({ where: identificador.includes('@')
    ? { correo: identificador.toLowerCase() } : { identificador: identificador.toUpperCase() } });
  const valida = await passwordCorrecta(contrasena, usuario?.passwordHash);
  if (!usuario?.activo || !valida) {
    throw new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales incorrectas, verifique su información');
  }
  const csrfToken = await iniciarSesion(req, usuario);
  res.json({ datos: vistaUsuario(usuario), csrfToken });
}

export function sesion(req: Request, res: Response) {
  res.json({ datos: vistaUsuario(req.usuario!), csrfToken: req.session.csrfToken });
}

export async function logout(req: Request, res: Response) {
  await cerrarSesion(req, res);
  res.status(204).end();
}

export async function recuperar(req: Request, res: Response) {
  const { correo } = s.solicitarReset.parse(req.body ?? {});
  const token = tokenAleatorio();
  const hash = hashToken(token);
  const usuarioId = await db.transaction(async transaction => {
    const usuario = encontrado(await Usuarios.findOne({
      where: { correo, activo: true, rol: 'ALU' }, transaction, lock: true,
    }), 'Este correo no está registrado');
    await Recuperaciones.upsert({ usuarioId: usuario.id, hash, venceEn: new Date(Date.now() + 1800000) }, { transaction });
    return usuario.id;
  });
  try {
    await enviarRecuperacion(correo, token);
  } catch {
    await Recuperaciones.destroy({ where: { usuarioId, hash } });
    throw new ApiError(503, 'CORREO_NO_DISPONIBLE', 'No fue posible enviar el correo de recuperación');
  }
  res.json({ mensaje: 'Correo de recuperación de contraseña enviado al correo proporcionado' });
}

export async function restablecer(req: Request, res: Response) {
  const { token, contrasena } = s.restablecer.parse(req.body ?? {});
  const hash = hashToken(token);
  const errorToken = () => new ApiError(400, 'TOKEN_INVALIDO', 'El enlace es inválido o ha vencido');
  const recuperacion = await Recuperaciones.findOne({ where: { hash, venceEn: { [Op.gt]: new Date() } } });
  if (!recuperacion) throw errorToken();
  const passwordHash = await hashPassword(contrasena);
  await db.transaction(async transaction => {
    const cuenta = await Usuarios.findByPk(recuperacion.usuarioId, { transaction, lock: true });
    if (!cuenta?.activo || cuenta.rol !== 'ALU') throw errorToken();
    const borradas = await Recuperaciones.destroy({
      where: { usuarioId: cuenta.id, hash, venceEn: { [Op.gt]: new Date() } }, transaction,
    });
    if (!borradas) throw errorToken();
    await cuenta.update({ passwordHash, versionSesion: cuenta.versionSesion + 1 }, { transaction });
  });
  res.json({ mensaje: 'Contraseña restablecida correctamente' });
}

export async function consultarPerfil(req: Request, res: Response) {
  const perfil = encontrado(await Alumnos.findByPk(req.usuario!.id), 'No se encontró el alumno');
  res.json({ datos: { ...vistaUsuario(req.usuario!), perfil } });
}

export async function actualizarPerfil(req: Request, res: Response) {
  const { contrasenaActual, nuevaContrasena, nombre, apellidos, telefono } = s.perfil.parse(req.body ?? {});
  const actual = encontrado(await Usuarios.findByPk(req.usuario!.id), 'No se encontró el alumno');
  if (!await passwordCorrecta(contrasenaActual, actual.passwordHash)) {
    throw new ApiError(400, 'CONTRASENA_INCORRECTA', 'La contraseña actual es incorrecta');
  }
  const passwordHash = nuevaContrasena ? await hashPassword(nuevaContrasena) : undefined;
  const resultado = await db.transaction(async transaction => {
    const cuenta = encontrado(await Usuarios.findByPk(actual.id, { transaction, lock: true }), 'No se encontró el alumno');
    if (!cuenta.activo || cuenta.rol !== 'ALU' || cuenta.versionSesion !== req.session.versionSesion) {
      throw new ApiError(401, 'SESION_REQUERIDA', 'Inicie sesión');
    }
    const alumno = encontrado(await Alumnos.findByPk(cuenta.id, { transaction, lock: true }), 'No se encontró el alumno');
    await alumno.update({ nombre, apellidos, telefono }, { transaction });
    if (nombre || apellidos) await cuenta.update({ nombreCompleto: [alumno.nombre, alumno.apellidos].filter(Boolean).join(' ') }, { transaction });
    if (passwordHash) {
      await cuenta.update({ passwordHash, versionSesion: cuenta.versionSesion + 1 }, { transaction });
      await Recuperaciones.destroy({ where: { usuarioId: cuenta.id }, transaction });
    }
    return { cuenta, alumno };
  });
  const csrfToken = passwordHash ? await iniciarSesion(req, resultado.cuenta) : req.session.csrfToken;
  res.json({ mensaje: 'Datos actualizados exitosamente', datos: { ...vistaUsuario(resultado.cuenta), perfil: resultado.alumno }, csrfToken });
}
