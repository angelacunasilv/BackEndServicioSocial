"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sinArchivo = void 0;
exports.expedienteDe = expedienteDe;
exports.cuentaAlumno = cuentaAlumno;
exports.consultar = consultar;
exports.emitir = emitir;
exports.consultarAlumno = consultarAlumno;
const node_crypto_1 = require("node:crypto");
const constants_1 = require("../config/constants");
const database_1 = require("../config/database");
const env_1 = require("../config/env");
const errors_1 = require("../http/errors");
const models_1 = require("../models");
const archivos_1 = require("./archivos");
const respuestas_1 = require("../views/respuestas");
exports.sinArchivo = { exclude: ['archivoPdf'] };
const pendiente = 'Debe estar registrado en un programa para revisar su expediente';
async function expedienteDe(alumnoId, transaction) {
    const expediente = await models_1.Expedientes.findOne({
        where: { alumnoId }, transaction, lock: transaction ? true : undefined,
    });
    if (!expediente)
        throw new errors_1.ApiError(409, 'EXPEDIENTE_NO_DISPONIBLE', pendiente);
    return expediente;
}
async function cuentaAlumno(numeroControl, transaction) {
    return (0, errors_1.encontrado)(await models_1.Usuarios.findOne({
        where: { identificador: numeroControl, rol: 'ALU' }, attributes: { exclude: ['passwordHash'] }, transaction,
    }), 'No se encontró el alumno');
}
async function consultar(alumnoId) {
    const expediente = await expedienteDe(alumnoId);
    const [programa, documentos] = await Promise.all([
        models_1.Programas.findByPk(expediente.programaId, { attributes: ['id', 'nombreProyecto', 'tipo', 'periodo'] }),
        models_1.Documentos.findAll({ where: { expedienteId: expediente.id, vigente: true }, attributes: exports.sinArchivo }),
    ]);
    const entregados = new Map(documentos.map(documento => [documento.tipo + ':' + documento.numeroReporte, documento]));
    return {
        ...expediente.get({ plain: true }), programa,
        porcentajeAvance: Number(expediente.porcentajeAvance),
        entregas: constants_1.entregas.map(entrega => {
            const documento = entregados.get(entrega.tipo + ':' + entrega.numeroReporte);
            return {
                tipo: entrega.tipo, numeroReporte: entrega.numeroReporte || null,
                estado: documento?.estado ?? 'SIN_ENTREGA',
                documento: documento ? (0, respuestas_1.vistaDocumento)(documento.get({ plain: true })) : null,
            };
        }),
    };
}
async function emitir(numeroControl, emisorId, emisorNombre) {
    const alumno = await cuentaAlumno(numeroControl);
    const incompleto = () => new errors_1.ApiError(409, 'EXPEDIENTE_INCOMPLETO', 'El expediente del alumno no se encuentra completo. No se puede emitir la constancia');
    return database_1.db.transaction(async (transaction) => {
        const expediente = await models_1.Expedientes.findOne({ where: { alumnoId: alumno.id }, lock: true, transaction });
        if (!expediente)
            throw incompleto();
        const existente = await models_1.Constancias.findOne({ where: { expedienteId: expediente.id }, attributes: exports.sinArchivo, transaction });
        if (existente)
            return { constancia: existente, nueva: false };
        const aceptados = await models_1.Documentos.findAll({
            where: { expedienteId: expediente.id, estado: 'ACEPTADO', vigente: true },
            attributes: ['tipo', 'numeroReporte'], transaction,
        });
        const requeridos = constants_1.entregas.filter(entrega => entrega.tipo !== 'SOLICITUD' && entrega.tipo !== 'CARTA_TERMINACION');
        const completos = requeridos.every(entrega => aceptados.some(documento => documento.tipo === entrega.tipo && documento.numeroReporte === entrega.numeroReporte));
        if (!completos || expediente.avanceHoras < env_1.env.HOURS_REQUIRED)
            throw incompleto();
        const programa = (0, errors_1.encontrado)(await models_1.Programas.findByPk(expediente.programaId, {
            attributes: ['nombreProyecto'], transaction,
        }), 'No se encontró el programa');
        const folio = (0, node_crypto_1.randomUUID)();
        const fechaEmision = new Date();
        const archivoPdf = await (0, archivos_1.generarPdf)({
            folio, fecha: fechaEmision.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            institucion: env_1.env.INSTITUTION_NAME, alumno: alumno.nombreCompleto, numeroControl,
            horas: expediente.avanceHoras, programa: programa.nombreProyecto, emisor: emisorNombre,
        });
        await expediente.update({ estadoGlobal: 'TERMINADO' }, { transaction });
        const constancia = await models_1.Constancias.create({ folio, expedienteId: expediente.id, emitidaPor: emisorId, fechaEmision, archivoPdf }, { transaction });
        return { constancia, nueva: true };
    });
}
async function consultarAlumno(numeroControl) {
    const alumno = await cuentaAlumno(numeroControl);
    return { alumno: (0, respuestas_1.vistaUsuario)(alumno), expediente: await consultar(alumno.id) };
}
