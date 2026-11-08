import { Request, Response } from 'express';
import { encontrado, ApiError } from '../http/errors';
import { Programas } from '../models';
import { verificarPdf } from '../services/archivos';
import * as flujo from '../services/programas';
import * as s from '../validation/schemas';
import { enviarPdf, lista, vistaPrograma } from '../views/respuestas';

export async function banco(req: Request, res: Response) {
  const { periodo, pagina, limite } = s.programaConsulta.parse(req.query);
  const filas = await Programas.findAndCountAll({
    where: {
      tipo: 'INTERNO',
      ...(req.usuario!.rol === 'ALU' ? { activo: true } : {}),
      ...(periodo ? { periodo } : {}),
    },
    attributes: flujo.datosSinPdf, order: [['id', 'DESC']], limit: limite, offset: (pagina - 1) * limite,
  });
  res.json(lista(filas, pagina, limite));
}

export async function consultarInterno(req: Request, res: Response) {
  const programa = encontrado(await Programas.findOne({
    where: { id: s.id.parse(req.params.id), tipo: 'INTERNO', ...(req.usuario!.rol === 'ALU' ? { activo: true } : {}) },
    attributes: flujo.datosSinPdf,
  }), 'No se encontró el programa');
  res.json({ datos: programa });
}

export async function crearInterno(req: Request, res: Response) {
  const programa = await flujo.crearInterno(req.usuario!.id, s.programaInterno.parse(req.body ?? {}));
  res.status(201).location('/api/programas/' + programa.id).json({
    mensaje: 'El programa ha sido subido exitosamente.', datos: vistaPrograma(programa.get({ plain: true })),
  });
}

export async function editarInterno(req: Request, res: Response) {
  const programa = await flujo.editarInterno(s.id.parse(req.params.id), s.programaInterno.parse(req.body ?? {}));
  res.json({ mensaje: 'Programa actualizado exitosamente', datos: programa });
}

export async function archivarInterno(req: Request, res: Response) {
  await flujo.archivarInterno(s.id.parse(req.params.id));
  res.status(204).end();
}

export async function seleccionar(req: Request, res: Response) {
  const { folio } = s.seleccion.parse(req.body ?? {});
  const expediente = await flujo.seleccionarInterno(req.usuario!.id, folio);
  res.status(201).location('/api/alumnos/me/expediente').json({
    mensaje: 'Programa de servicio social seleccionado con éxito', datos: expediente,
  });
}

export async function crearExterno(req: Request, res: Response) {
  const datos = s.programaExterno.parse(req.body ?? {});
  const archivo = req.file ? await verificarPdf(req.file) : undefined;
  const programa = await flujo.crearExterno(req.usuario!.id, datos, archivo);
  res.status(201).location('/api/alumnos/me/propuesta').json({
    mensaje: 'Su propuesta ha sido subida exitosamente.', datos: vistaPrograma(programa.get({ plain: true })),
  });
}

export async function propuestaPropia(req: Request, res: Response) {
  const propuesta = encontrado(await Programas.findOne({
    where: { creadoPor: req.usuario!.id, tipo: 'EXTERNO' }, attributes: flujo.datosSinPdf, order: [['id', 'DESC']],
  }), 'Aún no cuenta con una propuesta propia registrada');
  res.json({ datos: propuesta });
}

export async function listarExternos(req: Request, res: Response) {
  const { estado, pagina, limite } = s.revisiones.parse(req.query);
  const filas = await Programas.findAndCountAll({
    where: { tipo: 'EXTERNO', estado }, attributes: flujo.datosSinPdf,
    include: [{ association: 'autor', attributes: ['identificador', 'nombreCompleto'] }],
    order: [['id', 'ASC']], limit: limite, offset: (pagina - 1) * limite,
  });
  res.json(lista(filas, pagina, limite));
}

export async function descargarExterno(req: Request, res: Response) {
  const propuesta = encontrado(await Programas.findOne({
    where: { id: s.id.parse(req.params.id), tipo: 'EXTERNO' }, attributes: ['id', 'creadoPor', 'archivoPdf'],
  }), 'No se encontró la propuesta');
  if (req.usuario!.rol === 'ALU' && propuesta.creadoPor !== req.usuario!.id) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'No se encontró la propuesta');
  }
  enviarPdf(res, encontrado(propuesta.archivoPdf, 'El archivo no se encuentra disponible'), 'propuesta-' + propuesta.id + '.pdf');
}

export async function revisarExterno(req: Request, res: Response) {
  const programa = await flujo.revisarExterno(s.id.parse(req.params.id), req.usuario!.id, s.revision.parse(req.body ?? {}));
  res.json({ mensaje: 'El estado se ha asignado exitosamente.', datos: programa });
}
