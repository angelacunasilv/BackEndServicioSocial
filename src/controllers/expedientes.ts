import { Request, Response } from 'express';
import { z } from 'zod';
import { Constancias } from '../models';
import { encontrado } from '../http/errors';
import * as expedientes from '../services/expedientes';
import * as s from '../validation/schemas';
import { enviarPdf } from '../views/respuestas';

export async function mio(req: Request, res: Response) {
  res.json({ datos: await expedientes.consultar(req.usuario!.id) });
}

export async function consultar(req: Request, res: Response) {
  const { numeroControl } = s.alumnoConsulta.parse(req.query);
  res.json({ datos: await expedientes.consultarAlumno(numeroControl) });
}

export async function emitir(req: Request, res: Response) {
  const { numeroControl } = s.alumnoConsulta.parse(req.body ?? {});
  const { id, nombreCompleto } = req.usuario!;
  const { constancia, nueva } = await expedientes.emitir(numeroControl, id, nombreCompleto);
  const { folio, fechaEmision, firmado } = constancia;
  const url = '/api/constancias/' + folio + '/archivo';
  res.status(nueva ? 201 : 200).location(url).json({
    mensaje: 'Constancia de terminación generada con éxito.',
    datos: { folio, fechaEmision, firmado, descarga: url, vistaPrevia: url + '?vista=1' },
  });
}

export async function descargar(req: Request, res: Response) {
  const folio = z.uuid().parse(req.params.folio);
  const { vista } = z.strictObject({ vista: z.literal('1').optional() }).parse(req.query);
  const constancia = encontrado(await Constancias.findByPk(folio), 'No se encontró la constancia');
  enviarPdf(res, constancia.archivoPdf, 'constancia-' + folio + '.pdf', !vista);
}
