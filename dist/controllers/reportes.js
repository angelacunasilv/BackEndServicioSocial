"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reporteFaltantes = reporteFaltantes;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const errors_1 = require("../http/errors");
const schemas_1 = require("../validation/schemas");
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
function celdaCsv(value) {
    // Evita que una hoja de cálculo interprete nombres o periodos como fórmulas.
    const texto = /^\s*[=+\-@\t\r\n]/u.test(value) ? "'" + value : value;
    return '"' + texto.replace(/"/g, '""') + '"';
}
async function reporteFaltantes(req, res) {
    const { reporte, periodo, formato, pagina, limite } = schemas_1.faltantes.parse(req.query);
    const replacements = {
        periodo: periodo ?? null, tipo: reporte === 'final' ? 'REPORTE_FINAL' : 'REPORTE_BIMESTRAL',
        numero: reporte === 'final' ? 0 : Number(reporte), limite, offset: (pagina - 1) * limite,
    };
    const select = `SELECT u.identificador AS "numeroControl", u.nombre_completo AS "nombreCompleto",
    p.nombre_proyecto AS programa, p.periodo ${filtro} ORDER BY u.identificador`;
    if (formato === 'csv') {
        const filas = await database_1.db.query(select + ' LIMIT 10001', { replacements, type: sequelize_1.QueryTypes.SELECT });
        if (filas.length > 10000)
            throw new errors_1.ApiError(422, 'REPORTE_GRANDE', 'Seleccione un periodo para reducir el tamaño de la exportación');
        const lineas = filas.map(fila => [fila.numeroControl, fila.nombreCompleto, fila.programa, fila.periodo].map(celdaCsv).join(','));
        if (filas.length) {
            res.type('text/csv').attachment('faltantes-' + reporte + '.csv')
                .send('\uFEFFnumero_control,nombre_completo,programa,periodo\r\n' + lineas.join('\r\n') + '\r\n');
            return;
        }
    }
    const [datos, [conteo]] = await Promise.all([
        database_1.db.query(select + ' LIMIT :limite OFFSET :offset', { replacements, type: sequelize_1.QueryTypes.SELECT }),
        database_1.db.query('SELECT count(*)::int AS total ' + filtro, { replacements, type: sequelize_1.QueryTypes.SELECT }),
    ]);
    res.json({
        datos, paginacion: { pagina, limite, total: conteo.total },
        mensaje: conteo.total === 0 ? 'No se encontraron alumnos pendientes de entrega para este periodo' : undefined,
    });
}
