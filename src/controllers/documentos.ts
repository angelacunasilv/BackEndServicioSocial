import { Request, Response } from 'express';
import { db } from '../config/database';
import { env } from '../config/env';
import { ApiError, encontrado } from '../http/errors';
import { Documentos, Expedientes, Plantillas } from '../models';
import { verificarPdf } from '../services/archivos';
import { expedienteDe, sinArchivo } from '../services/expedientes';
import * as s from '../validation/schemas';
import { enviarPdf, lista, vistaDocumento } from '../views/respuestas';

export async function subir(req: Request, res: Response) {
  const datos = s.documento.parse({ ...req.body, archivo: req.file });
  const archivoPdf = await verificarPdf(datos.archivo);
  const numeroReporte = 'numeroReporte' in datos ? datos.numeroReporte : 0;
  const horas = 'horas' in datos ? datos.horas : null;
  const nombreArchivo = datos.archivo.originalname.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g, '').slice(-255);
  const documento = await db.transaction(async transaction => {
    const expediente = await expedienteDe(req.usuario!.id, transaction);
    const anterior = await Documentos.findOne({
      where: { expedienteId: expediente.id, tipo: datos.tipo, numeroReporte, vigente: true },
      attributes: sinArchivo, transaction,
    });
    if (anterior?.estado === 'ACEPTADO') {
      throw new ApiError(409, 'DOCUMENTO_ACEPTADO', 'El documento ya fue aceptado');
    }
    if (anterior) await anterior.update({ vigente: false }, { transaction });
    return Documentos.create({
      expedienteId: expediente.id, tipo: datos.tipo, numeroReporte, horas,
      nombreArchivo, archivoPdf, tamano: archivoPdf.length,
    }, { transaction });
  });
  res.status(201).location('/api/documentos/' + documento.id + '/archivo').json({
    mensaje: 'Su documento ha sido subido exitosamente.', datos: vistaDocumento(documento.get({ plain: true })),
  });
}

export async function listar(req: Request, res: Response) {
  const { estado, pagina, limite } = s.revisiones.parse(req.query);
  const filas = await Documentos.findAndCountAll({
    where: { estado, vigente: true }, attributes: sinArchivo,
    include: [{ association: 'expediente', attributes: ['id', 'alumnoId'],
      include: [{ association: 'alumno', attributes: ['usuarioId'],
        include: [{ association: 'usuario', attributes: ['identificador', 'nombreCompleto'] }],
      }],
    }],
    order: [['id', 'ASC']], limit: limite, offset: (pagina - 1) * limite,
  });
  res.json(lista(filas, pagina, limite));
}

export async function descargar(req: Request, res: Response) {
  const id = s.id.parse(req.params.id);
  const propietario = req.usuario!.rol === 'ALU' ? { alumnoId: req.usuario!.id } : undefined;
  const documento = encontrado(await Documentos.findByPk(id, {
    attributes: ['id', 'archivoPdf'],
    include: [{ association: 'expediente', attributes: [], where: propietario }],
  }), 'No se encontró el documento');
  enviarPdf(res, documento.archivoPdf, 'documento-' + id + '.pdf');
}

export async function revisar(req: Request, res: Response) {
  const id = s.id.parse(req.params.id);
  const datos = s.revision.parse(req.body ?? {});
  const documento = await db.transaction(async transaction => {
    const original = encontrado(await Documentos.findByPk(id, {
      attributes: ['expedienteId'], transaction,
    }), 'No se encontró el documento');
    const expediente = encontrado(await Expedientes.findByPk(original.expedienteId, {
      lock: true, transaction,
    }), 'No se encontró el expediente');
    const documento = encontrado(await Documentos.findByPk(id, { attributes: sinArchivo, transaction }), 'No se encontró el documento');
    if (!documento.vigente || documento.estado !== 'PENDIENTE') {
      throw new ApiError(409, 'DOCUMENTO_NO_REVISABLE', 'El documento ya fue revisado o reemplazado');
    }
    await documento.update({
      ...datos, observaciones: datos.observaciones || null,
      fechaValidacion: new Date(), revisadoPor: req.usuario!.id,
    }, { transaction });

    if (datos.estado === 'ACEPTADO' && documento.horas !== null) {
      const avanceHoras = expediente.avanceHoras + documento.horas;
      await expediente.update({
        avanceHoras, porcentajeAvance: Math.min(100, 100 * avanceHoras / env.HOURS_REQUIRED).toFixed(2),
      }, { transaction });
    }
    return documento;
  });
  res.json({ mensaje: 'El estado se ha asignado exitosamente.', datos: vistaDocumento(documento.get({ plain: true })) });
}

export async function listarPlantillas(_req: Request, res: Response) {
  res.json({ datos: await Plantillas.findAll({ attributes: ['tipo'], order: [['tipo', 'ASC']] }) });
}

export async function descargarPlantilla(req: Request, res: Response) {
  const tipo = s.tipoDocumento.parse(req.params.tipo);
  const plantilla = encontrado(await Plantillas.findByPk(tipo), 'El archivo no se encuentra disponible');
  enviarPdf(res, plantilla.archivoPdf, tipo + '.pdf');
}

export async function cargarPlantilla(req: Request, res: Response) {
  const { tipo, archivo } = s.plantilla.parse({ ...req.body, archivo: req.file });
  await Plantillas.upsert({ tipo, archivoPdf: await verificarPdf(archivo), actualizadoPor: req.usuario!.id });
  res.json({ mensaje: 'Plantilla guardada', datos: { tipo } });
}
