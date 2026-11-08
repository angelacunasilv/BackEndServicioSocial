import { Transaction, UniqueConstraintError } from 'sequelize';
import { z } from 'zod';
import { db } from '../config/database';
import { ApiError, encontrado } from '../http/errors';
import { Alumnos, Personal, Recuperaciones, Usuario, Usuarios } from '../models';
import { usuarioEditar, usuarioNuevo } from '../validation/schemas';
import { hashPassword, tokenAleatorio } from './crypto';

type Datos = z.infer<typeof usuarioNuevo>;
const duplicado = () => new ApiError(409, 'USUARIO_DUPLICADO', 'El usuario ya se encuentra registrado');

async function guardarPerfil(id: number, datos: Datos, transaction: Transaction, renombrar = true) {
  if (datos.rol === 'ALU') {
    const alumno = await Alumnos.findByPk(id, { transaction, lock: true });
    const [nombre, ...apellidos] = datos.nombreCompleto.split(/\s+/);
    const perfil = { carrera: datos.carrera, semestre: datos.semestre, planEstudios: datos.planEstudios };
    if (alumno) {
      await alumno.update(renombrar ? { ...perfil, nombre, apellidos: apellidos.join(' ') } : perfil, { transaction });
    } else {
      await Alumnos.create({ usuarioId: id, nombre, apellidos: apellidos.join(' '), ...perfil }, { transaction });
    }
  } else {
    const [personal] = await Personal.findOrCreate({ where: { usuarioId: id }, transaction });
    if (datos.departamento !== undefined) await personal.update({ departamento: datos.departamento }, { transaction });
  }
}

export async function alta(datos: Datos) {
  const contrasenaInicial = datos.contrasena ? undefined : tokenAleatorio();
  const passwordHash = await hashPassword(datos.contrasena ?? contrasenaInicial!);
  try {
    const usuario = await db.transaction(async transaction => {
      const cuenta = await Usuarios.create({
        identificador: datos.identificador, nombreCompleto: datos.nombreCompleto,
        correo: datos.correo, rol: datos.rol, passwordHash,
      }, { transaction });
      await guardarPerfil(cuenta.id, datos, transaction);
      return cuenta;
    });
    return { usuario, contrasenaInicial };
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw duplicado();
    throw error;
  }
}

async function cambiosAdministrativos(
  id: number,
  aplicar: (usuario: Usuario, transaction: Transaction) => Promise<Partial<Usuario>>,
) {
  try {
    return await db.transaction(async transaction => {
      // Serializa bajas y cambios de rol para conservar al menos un administrador activo.
      await db.query('SELECT pg_advisory_xact_lock(683103223)', { transaction });
      const cuenta = encontrado(await Usuarios.findByPk(id, { transaction, lock: true }), 'No se encontró el usuario');
      const datos = await aplicar(cuenta, transaction);
      if (cuenta.activo && cuenta.rol === 'ADM' && (datos.activo === false || (datos.rol && datos.rol !== 'ADM'))) {
        const administradores = await Usuarios.count({ where: { activo: true, rol: 'ADM' }, transaction });
        if (administradores <= 1) throw new ApiError(409, 'ULTIMO_ADMIN', 'Debe quedar un administrador activo');
      }
      await cuenta.update({ ...datos, versionSesion: cuenta.versionSesion + 1 }, { transaction });
      await Recuperaciones.destroy({ where: { usuarioId: id }, transaction });
      return cuenta;
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw duplicado();
    throw error;
  }
}

export async function editar(id: number, datos: z.infer<typeof usuarioEditar>) {
  const passwordHash = datos.contrasena ? await hashPassword(datos.contrasena) : undefined;
  return cambiosAdministrativos(id, async (cuenta, transaction) => {
    await guardarPerfil(id, datos, transaction, cuenta.nombreCompleto !== datos.nombreCompleto);
    const { identificador, nombreCompleto, correo, rol, activo } = datos;
    return { identificador, nombreCompleto, correo, rol, activo, passwordHash };
  });
}

export const baja = (id: number) => cambiosAdministrativos(id, async () => ({ activo: false }));
