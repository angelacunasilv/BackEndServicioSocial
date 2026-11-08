"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.datosSinPdf = void 0;
exports.crearInterno = crearInterno;
exports.editarInterno = editarInterno;
exports.archivarInterno = archivarInterno;
exports.seleccionarInterno = seleccionarInterno;
exports.crearExterno = crearExterno;
exports.revisarExterno = revisarExterno;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const errors_1 = require("../http/errors");
const models_1 = require("../models");
exports.datosSinPdf = {
    exclude: ['archivoPdf'],
    include: [[sequelize_1.Sequelize.literal('"archivo_pdf" IS NOT NULL'), 'adjunto']],
};
function periodoActual() {
    const fecha = new Date();
    return fecha.getUTCFullYear() + '-' + (fecha.getUTCMonth() < 6 ? '1' : '2');
}
async function crearInterno(autor, datos) {
    return models_1.Programas.create({
        ...datos, periodo: datos.periodo ?? periodoActual(), tipo: 'INTERNO', creadoPor: autor,
        cupoDisponible: datos.cupo, estado: 'ACEPTADO',
    });
}
async function actualizarInterno(id, cambiar) {
    return database_1.db.transaction(async (transaction) => {
        const programa = (0, errors_1.encontrado)(await models_1.Programas.findOne({
            where: { id, tipo: 'INTERNO' }, attributes: exports.datosSinPdf, lock: true, transaction,
        }), 'No se encontró el programa');
        await cambiar(programa, transaction);
        return programa;
    });
}
function editarInterno(id, datos) {
    return actualizarInterno(id, async (programa, transaction) => {
        const inscritos = programa.cupo - programa.cupoDisponible;
        if (datos.cupo < inscritos)
            throw new errors_1.ApiError(409, 'CUPO_INSUFICIENTE', 'El cupo no puede ser menor que las inscripciones existentes');
        await programa.update({ ...datos, cupoDisponible: datos.cupo - inscritos }, { transaction });
    });
}
function archivarInterno(id) {
    return actualizarInterno(id, async (programa, transaction) => {
        await programa.update({ activo: false }, { transaction });
    });
}
async function alumnoSinPrograma(id, transaction) {
    const cuenta = await models_1.Usuarios.findByPk(id, { attributes: ['activo', 'rol'], lock: true, transaction });
    if (!cuenta?.activo || cuenta.rol !== 'ALU') {
        throw new errors_1.ApiError(409, 'ALUMNO_NO_ACTIVO', 'El alumno debe tener un acceso activo');
    }
    const alumno = (0, errors_1.encontrado)(await models_1.Alumnos.findByPk(id, { lock: true, transaction }), 'No se encontró el alumno');
    if (!alumno.cursoInduccionAcreditado) {
        throw new errors_1.ApiError(409, 'INDUCCION_REQUERIDA', 'Debe acreditar el curso de inducción antes de seleccionar un programa');
    }
    if (await models_1.Expedientes.findOne({ where: { alumnoId: id }, transaction })) {
        throw new errors_1.ApiError(409, 'PROGRAMA_ASIGNADO', 'Ya tiene un programa de servicio social asignado');
    }
    return alumno;
}
async function exigirSinPropuestaPendiente(id, transaction) {
    const pendiente = await models_1.Programas.findOne({
        where: { tipo: 'EXTERNO', creadoPor: id, estado: 'PENDIENTE' }, attributes: ['id'], transaction,
    });
    if (pendiente)
        throw new errors_1.ApiError(409, 'PROPUESTA_PENDIENTE', 'Ya tiene una propuesta propia pendiente de revisión');
}
async function seleccionarInterno(alumnoId, id) {
    return database_1.db.transaction(async (transaction) => {
        await alumnoSinPrograma(alumnoId, transaction);
        await exigirSinPropuestaPendiente(alumnoId, transaction);
        const programa = (0, errors_1.encontrado)(await models_1.Programas.findOne({
            where: { id, tipo: 'INTERNO', activo: true }, attributes: ['id', 'cupoDisponible'], lock: true, transaction,
        }), 'No se encontró el programa');
        if (!programa.cupoDisponible) {
            throw new errors_1.ApiError(409, 'CUPO_LLENO', 'El cupo de este programa ya está lleno');
        }
        await programa.update({ cupoDisponible: programa.cupoDisponible - 1 }, { transaction });
        return models_1.Expedientes.create({ alumnoId, programaId: id }, { transaction });
    });
}
async function crearExterno(alumnoId, datos, archivoPdf) {
    return database_1.db.transaction(async (transaction) => {
        await alumnoSinPrograma(alumnoId, transaction);
        await exigirSinPropuestaPendiente(alumnoId, transaction);
        const { nombreEmpresa, ...contacto } = datos;
        return models_1.Programas.create({
            ...contacto, nombreProyecto: nombreEmpresa, tipo: 'EXTERNO', creadoPor: alumnoId,
            periodo: periodoActual(), archivoPdf,
        }, { transaction });
    });
}
async function revisarExterno(id, revisor, datos) {
    return database_1.db.transaction(async (transaction) => {
        const original = (0, errors_1.encontrado)(await models_1.Programas.findOne({
            where: { id, tipo: 'EXTERNO' }, attributes: ['creadoPor'], transaction,
        }), 'No se encontró la propuesta');
        // El mismo orden de bloqueos se usa al inscribir y al resolver propuestas.
        if (datos.estado === 'ACEPTADO')
            await alumnoSinPrograma(original.creadoPor, transaction);
        else
            await models_1.Alumnos.findByPk(original.creadoPor, { lock: true, transaction });
        const programa = (0, errors_1.encontrado)(await models_1.Programas.findByPk(id, {
            attributes: exports.datosSinPdf, lock: true, transaction,
        }), 'No se encontró la propuesta');
        if (programa.estado !== 'PENDIENTE')
            throw new errors_1.ApiError(409, 'PROPUESTA_REVISADA', 'La propuesta ya fue revisada');
        await programa.update({
            estado: datos.estado, observaciones: datos.observaciones || null, revisadoPor: revisor, fechaRevision: new Date(),
        }, { transaction });
        if (datos.estado === 'ACEPTADO') {
            await models_1.Expedientes.create({ alumnoId: original.creadoPor, programaId: id }, { transaction });
        }
        return programa;
    });
}
