import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';

import { db } from '../config/database';
import { ApiError } from '../http/errors';
import { Alumnos, Asistencias, Cursos, Usuarios } from '../models';
import * as s from '../validation/schemas';

async function leerControles(archivo: Express.Multer.File) {
  let filas: unknown[][];
  try {
    if (/\.csv$/i.test(archivo.originalname)) {
      filas = parse(archivo.buffer, { bom: true, skip_empty_lines: true, max_record_size: 256 });
    } else if (/\.xlsx$/i.test(archivo.originalname)) {
      // Limita el tamaño de la hoja antes de procesar archivos de asistencia.
      if (archivo.size > 1024 * 1024) throw new Error('Excel demasiado grande');
      const { readSheet } = await import('read-excel-file/node');
      filas = await readSheet(archivo.buffer);
    } else {
      throw new Error('Extensión inválida');
    }
  } catch {
    throw new ApiError(400, 'LISTA_INVALIDA', 'Formato de archivo no válido. Suba un archivo Excel o CSV');
  }
  const controles = filas.map(fila => typeof fila[0] === 'number' ? String(fila[0]) : fila[0]);
  if (typeof controles[0] === 'string' && controles[0].trim().toLowerCase() === 'numero_control') controles.shift();
  return [...new Set(s.listaControles.parse(controles))];
}

export async function cargar(req: Request, res: Response) {
  const { archivo, fechaCurso, periodo } = s.asistencia.parse({ ...req.body, archivo: req.file });
  const controles = await leerControles(archivo);
  const resultado = await db.transaction(async transaction => {
    const cuentas = await Usuarios.findAll({
      where: { identificador: controles, rol: 'ALU', activo: true }, attributes: ['id', 'identificador'],
      order: [['id', 'ASC']], lock: true, transaction,
    });
    const existentes = new Set(cuentas.map(cuenta => cuenta.identificador));
    const faltan = controles.filter(control => !existentes.has(control));
    if (faltan.length) {
      throw new ApiError(400, 'ALUMNOS_NO_ENCONTRADOS', 'Algunos números de control no corresponden a alumnos activos', faltan);
    }
    const [curso] = await Cursos.findOrCreate({
      where: { fechaCurso, periodo }, defaults: { codigoQr: randomUUID(), creadoPor: req.usuario!.id }, transaction,
    });
    const ids = cuentas.map(cuenta => cuenta.id);
    await Asistencias.bulkCreate(ids.map(alumnoId => ({ alumnoId, cursoId: curso.id })), { ignoreDuplicates: true, transaction });
    await Alumnos.update({ cursoInduccionAcreditado: true }, { where: { usuarioId: ids }, transaction });
    return { curso, totalAsistentes: await Asistencias.count({ where: { cursoId: curso.id }, transaction }) };
  });
  res.json({ mensaje: 'Lista de asistencia cargada y alumnos habilitados exitosamente', datos: resultado });
}
