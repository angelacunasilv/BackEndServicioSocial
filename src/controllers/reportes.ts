import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { db } from '../config/database';
import { ApiError } from '../http/errors';
import { faltantes } from '../validation/schemas';

interface Faltante { numeroControl: string; nombreCompleto: string; programa: string; periodo: string }

const filtro = `
  FROM expedientes e
  JOIN usuarios u ON u.id = e.alumno_id
  JOIN programas p ON p.id = e.programa_id
  WHERE e.estado_global = 'INSCRITO' AND u.activo AND u.rol = 'ALU'
    AND (:periodo IS NULL OR p.periodo = :periodo)
    AND NOT EXISTS (
      SELECT 1 FROM documentos d
      WHERE d.expediente_id = e.id AND d.vigente AND d.tipo = :tipo AND d.numero_reporte = :numero
    )
`;

function celdaCsv(value: string) {
  // Evita que una hoja de cálculo interprete nombres o periodos como fórmulas.
  const texto = /^\s*[=+\-@\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + texto.replace(/"/g, '""') + '"';
}

export async function reporteFaltantes(req: Request, res: Response) {
  const { reporte, periodo, formato, pagina, limite } = faltantes.parse(req.query);
  const replacements = {
    periodo: periodo ?? null, tipo: reporte === 'final' ? 'REPORTE_FINAL' : 'REPORTE_BIMESTRAL',
    numero: reporte === 'final' ? 0 : Number(reporte), limite, offset: (pagina - 1) * limite,
  };
  const select = `SELECT u.identificador AS "numeroControl", u.nombre_completo AS "nombreCompleto",
    p.nombre_proyecto AS programa, p.periodo ${filtro} ORDER BY u.identificador`;
  if (formato === 'csv') {
    const filas = await db.query<Faltante>(select + ' LIMIT 10001', { replacements, type: QueryTypes.SELECT });
    if (filas.length > 10000) throw new ApiError(422, 'REPORTE_GRANDE', 'Seleccione un periodo para reducir el tamaño de la exportación');
    const lineas = filas.map(fila => [fila.numeroControl, fila.nombreCompleto, fila.programa, fila.periodo].map(celdaCsv).join(','));
    if (filas.length) {
      res.type('text/csv').attachment('faltantes-' + reporte + '.csv')
        .send('\uFEFFnumero_control,nombre_completo,programa,periodo\r\n' + lineas.join('\r\n') + '\r\n');
      return;
    }
  }
  const [datos, [conteo]] = await Promise.all([
    db.query<Faltante>(select + ' LIMIT :limite OFFSET :offset', { replacements, type: QueryTypes.SELECT }),
    db.query<{ total: number }>('SELECT count(*)::int AS total ' + filtro, { replacements, type: QueryTypes.SELECT }),
  ]);
  res.json({
    datos, paginacion: { pagina, limite, total: conteo.total },
    mensaje: conteo.total === 0 ? 'No se encontraron alumnos pendientes de entrega para este periodo' : undefined,
  });
}
