import { randomUUID } from 'node:crypto';
import { Transaction } from 'sequelize';
import { entregas } from '../config/constants';
import { db } from '../config/database';
import { env } from '../config/env';
import { ApiError, encontrado } from '../http/errors';
import { Constancias, Documentos, Expedientes, Programas, Usuarios } from '../models';
import { generarPdf } from './archivos';
import { vistaDocumento, vistaUsuario } from '../views/respuestas';

export const sinArchivo = { exclude: ['archivoPdf'] };
const pendiente = 'Debe estar registrado en un programa para revisar su expediente';

export async function expedienteDe(alumnoId: number, transaction?: Transaction) {
  const expediente = await Expedientes.findOne({
    where: { alumnoId }, transaction, lock: transaction ? true : undefined,
  });
  if (!expediente) throw new ApiError(409, 'EXPEDIENTE_NO_DISPONIBLE', pendiente);
  return expediente;
}

export async function cuentaAlumno(numeroControl: string, transaction?: Transaction) {
  return encontrado(await Usuarios.findOne({
    where: { identificador: numeroControl, rol: 'ALU' }, attributes: { exclude: ['passwordHash'] }, transaction,
  }), 'No se encontró el alumno');
}

export async function consultar(alumnoId: number) {
  const expediente = await expedienteDe(alumnoId);
  const [programa, documentos] = await Promise.all([
    Programas.findByPk(expediente.programaId, { attributes: ['id', 'nombreProyecto', 'tipo', 'periodo'] }),
    Documentos.findAll({ where: { expedienteId: expediente.id, vigente: true }, attributes: sinArchivo }),
  ]);
  const entregados = new Map(documentos.map(documento => [documento.tipo + ':' + documento.numeroReporte, documento]));
  return {
    ...expediente.get({ plain: true }), programa,
    porcentajeAvance: Number(expediente.porcentajeAvance),
    entregas: entregas.map(entrega => {
      const documento = entregados.get(entrega.tipo + ':' + entrega.numeroReporte);
      return {
        tipo: entrega.tipo, numeroReporte: entrega.numeroReporte || null,
        estado: documento?.estado ?? 'SIN_ENTREGA',
        documento: documento ? vistaDocumento(documento.get({ plain: true })) : null,
      };
    }),
  };
}

export async function emitir(numeroControl: string, emisorId: number, emisorNombre: string) {
  const alumno = await cuentaAlumno(numeroControl);
  const incompleto = () => new ApiError(409, 'EXPEDIENTE_INCOMPLETO',
    'El expediente del alumno no se encuentra completo. No se puede emitir la constancia');
  return db.transaction(async transaction => {
    const expediente = await Expedientes.findOne({ where: { alumnoId: alumno.id }, lock: true, transaction });
    if (!expediente) throw incompleto();
    const existente = await Constancias.findOne({ where: { expedienteId: expediente.id }, attributes: sinArchivo, transaction });
    if (existente) return { constancia: existente, nueva: false };

    const aceptados = await Documentos.findAll({
      where: { expedienteId: expediente.id, estado: 'ACEPTADO', vigente: true },
      attributes: ['tipo', 'numeroReporte'], transaction,
    });
    const requeridos = entregas.filter(entrega => entrega.tipo !== 'SOLICITUD' && entrega.tipo !== 'CARTA_TERMINACION');
    const completos = requeridos.every(entrega => aceptados.some(
      documento => documento.tipo === entrega.tipo && documento.numeroReporte === entrega.numeroReporte,
    ));
    if (!completos || expediente.avanceHoras < env.HOURS_REQUIRED) throw incompleto();

    const programa = encontrado(await Programas.findByPk(expediente.programaId, {
      attributes: ['nombreProyecto'], transaction,
    }), 'No se encontró el programa');
    const folio = randomUUID();
    const fechaEmision = new Date();
    const archivoPdf = await generarPdf({
      folio, fecha: fechaEmision.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
      institucion: env.INSTITUTION_NAME, alumno: alumno.nombreCompleto, numeroControl,
      horas: expediente.avanceHoras, programa: programa.nombreProyecto, emisor: emisorNombre,
    });
    await expediente.update({ estadoGlobal: 'TERMINADO' }, { transaction });
    const constancia = await Constancias.create({ folio, expedienteId: expediente.id, emitidaPor: emisorId, fechaEmision, archivoPdf }, { transaction });
    return { constancia, nueva: true };
  });
}

export async function consultarAlumno(numeroControl: string) {
  const alumno = await cuentaAlumno(numeroControl);
  return { alumno: vistaUsuario(alumno), expediente: await consultar(alumno.id) };
}
