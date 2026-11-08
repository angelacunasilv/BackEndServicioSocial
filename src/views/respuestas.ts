import { Response } from 'express';
import { Documento, Programa, Usuario } from '../models';

export function vistaUsuario(usuario: Usuario) {
  const { id, identificador, nombreCompleto, correo, rol, activo, fechaCreacion } = usuario;
  return { id, identificador, nombreCompleto, correo, rol, activo, fechaCreacion };
}

export function vistaPrograma(programa: Programa) {
  const { archivoPdf, ...datos } = programa;
  return { ...datos, adjunto: archivoPdf !== undefined ? Boolean(archivoPdf) : undefined };
}

export function vistaDocumento(documento: Documento) {
  const { archivoPdf: _archivoPdf, ...datos } = documento;
  return { ...datos, numeroReporte: datos.numeroReporte || null };
}

export function lista<T>(filas: { rows: T[]; count: number }, pagina: number, limite: number) {
  return { datos: filas.rows, paginacion: { pagina, limite, total: filas.count } };
}

export function enviarPdf(res: Response, contenido: Buffer, nombre: string, descargar = true) {
  const modo = descargar ? 'attachment' : 'inline';
  // Los nombres los construye el servidor con identificadores validados.
  res.type('application/pdf').set('Content-Disposition', modo + '; filename="' + nombre + '"').send(contenido);
}
