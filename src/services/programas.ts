import { Sequelize, Transaction } from 'sequelize';
import { z } from 'zod';
import { db } from '../config/database';
import { ApiError, encontrado } from '../http/errors';
import { Alumnos, Expedientes, Fila, Programa, Programas, Usuarios } from '../models';
import { programaExterno, programaInterno, revision } from '../validation/schemas';

export const datosSinPdf = {
  exclude: ['archivoPdf'],
  include: [[Sequelize.literal('"archivo_pdf" IS NOT NULL'), 'adjunto'] as [ReturnType<typeof Sequelize.literal>, string]],
};

function periodoActual() {
  const fecha = new Date();
  return fecha.getUTCFullYear() + '-' + (fecha.getUTCMonth() < 6 ? '1' : '2');
}

export async function crearInterno(autor: number, datos: z.infer<typeof programaInterno>) {
  return Programas.create({
    ...datos, periodo: datos.periodo ?? periodoActual(), tipo: 'INTERNO', creadoPor: autor,
    cupoDisponible: datos.cupo, estado: 'ACEPTADO',
  });
}

async function actualizarInterno(id: number, cambiar: (programa: Fila<Programa>, tx: Transaction) => Promise<void>) {
  return db.transaction(async transaction => {
    const programa = encontrado(await Programas.findOne({
      where: { id, tipo: 'INTERNO' }, attributes: datosSinPdf, lock: true, transaction,
    }), 'No se encontró el programa');
    await cambiar(programa, transaction);
    return programa;
  });
}

export function editarInterno(id: number, datos: z.infer<typeof programaInterno>) {
  return actualizarInterno(id, async (programa, transaction) => {
    const inscritos = programa.cupo! - programa.cupoDisponible!;
    if (datos.cupo < inscritos) throw new ApiError(409, 'CUPO_INSUFICIENTE', 'El cupo no puede ser menor que las inscripciones existentes');
    await programa.update({ ...datos, cupoDisponible: datos.cupo - inscritos }, { transaction });
  });
}

export function archivarInterno(id: number) {
  return actualizarInterno(id, async (programa, transaction) => {
    await programa.update({ activo: false }, { transaction });
  });
}

async function alumnoSinPrograma(id: number, transaction: Transaction) {
  const cuenta = await Usuarios.findByPk(id, { attributes: ['activo', 'rol'], lock: true, transaction });
  if (!cuenta?.activo || cuenta.rol !== 'ALU') {
    throw new ApiError(409, 'ALUMNO_NO_ACTIVO', 'El alumno debe tener un acceso activo');
  }
  const alumno = encontrado(await Alumnos.findByPk(id, { lock: true, transaction }), 'No se encontró el alumno');
  if (!alumno.cursoInduccionAcreditado) {
    throw new ApiError(409, 'INDUCCION_REQUERIDA', 'Debe acreditar el curso de inducción antes de seleccionar un programa');
  }
  if (await Expedientes.findOne({ where: { alumnoId: id }, transaction })) {
    throw new ApiError(409, 'PROGRAMA_ASIGNADO', 'Ya tiene un programa de servicio social asignado');
  }
  return alumno;
}

async function exigirSinPropuestaPendiente(id: number, transaction: Transaction) {
  const pendiente = await Programas.findOne({
    where: { tipo: 'EXTERNO', creadoPor: id, estado: 'PENDIENTE' }, attributes: ['id'], transaction,
  });
  if (pendiente) throw new ApiError(409, 'PROPUESTA_PENDIENTE', 'Ya tiene una propuesta propia pendiente de revisión');
}

export async function seleccionarInterno(alumnoId: number, id: number) {
  return db.transaction(async transaction => {
    await alumnoSinPrograma(alumnoId, transaction);
    await exigirSinPropuestaPendiente(alumnoId, transaction);
    const programa = encontrado(await Programas.findOne({
      where: { id, tipo: 'INTERNO', activo: true }, attributes: ['id', 'cupoDisponible'], lock: true, transaction,
    }), 'No se encontró el programa');
    if (!programa.cupoDisponible) {
      throw new ApiError(409, 'CUPO_LLENO', 'El cupo de este programa ya está lleno');
    }
    await programa.update({ cupoDisponible: programa.cupoDisponible - 1 }, { transaction });
    return Expedientes.create({ alumnoId, programaId: id }, { transaction });
  });
}

export async function crearExterno(alumnoId: number, datos: z.infer<typeof programaExterno>, archivoPdf?: Buffer) {
  return db.transaction(async transaction => {
    await alumnoSinPrograma(alumnoId, transaction);
    await exigirSinPropuestaPendiente(alumnoId, transaction);
    const { nombreEmpresa, ...contacto } = datos;
    return Programas.create({
      ...contacto, nombreProyecto: nombreEmpresa, tipo: 'EXTERNO', creadoPor: alumnoId,
      periodo: periodoActual(), archivoPdf,
    }, { transaction });
  });
}

export async function revisarExterno(id: number, revisor: number, datos: z.infer<typeof revision>) {
  return db.transaction(async transaction => {
    const original = encontrado(await Programas.findOne({
      where: { id, tipo: 'EXTERNO' }, attributes: ['creadoPor'], transaction,
    }), 'No se encontró la propuesta');
    // El mismo orden de bloqueos se usa al inscribir y al resolver propuestas.
    if (datos.estado === 'ACEPTADO') await alumnoSinPrograma(original.creadoPor, transaction);
    else await Alumnos.findByPk(original.creadoPor, { lock: true, transaction });
    const programa = encontrado(await Programas.findByPk(id, {
      attributes: datosSinPdf, lock: true, transaction,
    }), 'No se encontró la propuesta');
    if (programa.estado !== 'PENDIENTE') throw new ApiError(409, 'PROPUESTA_REVISADA', 'La propuesta ya fue revisada');
    await programa.update({
      estado: datos.estado, observaciones: datos.observaciones || null, revisadoPor: revisor, fechaRevision: new Date(),
    }, { transaction });
    if (datos.estado === 'ACEPTADO') {
      await Expedientes.create({ alumnoId: original.creadoPor, programaId: id }, { transaction });
    }
    return programa;
  });
}
