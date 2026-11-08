"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.subir = subir;
exports.listar = listar;
exports.descargar = descargar;
exports.revisar = revisar;
exports.listarPlantillas = listarPlantillas;
exports.descargarPlantilla = descargarPlantilla;
exports.cargarPlantilla = cargarPlantilla;
const database_1 = require("../config/database");
const env_1 = require("../config/env");
const errors_1 = require("../http/errors");
const models_1 = require("../models");
const archivos_1 = require("../services/archivos");
const expedientes_1 = require("../services/expedientes");
const s = __importStar(require("../validation/schemas"));
const respuestas_1 = require("../views/respuestas");
async function subir(req, res) {
    const datos = s.documento.parse({ ...req.body, archivo: req.file });
    const archivoPdf = await (0, archivos_1.verificarPdf)(datos.archivo);
    const numeroReporte = 'numeroReporte' in datos ? datos.numeroReporte : 0;
    const horas = 'horas' in datos ? datos.horas : null;
    const nombreArchivo = datos.archivo.originalname.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(-255);
    const documento = await database_1.db.transaction(async (transaction) => {
        const expediente = await (0, expedientes_1.expedienteDe)(req.usuario.id, transaction);
        const anterior = await models_1.Documentos.findOne({
            where: { expedienteId: expediente.id, tipo: datos.tipo, numeroReporte, vigente: true },
            attributes: expedientes_1.sinArchivo, transaction,
        });
        if (anterior?.estado === 'ACEPTADO') {
            throw new errors_1.ApiError(409, 'DOCUMENTO_ACEPTADO', 'El documento ya fue aceptado');
        }
        if (anterior)
            await anterior.update({ vigente: false }, { transaction });
        return models_1.Documentos.create({
            expedienteId: expediente.id, tipo: datos.tipo, numeroReporte, horas,
            nombreArchivo, archivoPdf, tamano: archivoPdf.length,
        }, { transaction });
    });
    res.status(201).location('/api/documentos/' + documento.id + '/archivo').json({
        mensaje: 'Su documento ha sido subido exitosamente.', datos: (0, respuestas_1.vistaDocumento)(documento.get({ plain: true })),
    });
}
async function listar(req, res) {
    const { estado, pagina, limite } = s.revisiones.parse(req.query);
    const filas = await models_1.Documentos.findAndCountAll({
        where: { estado, vigente: true }, attributes: expedientes_1.sinArchivo,
        include: [{ association: 'expediente', attributes: ['id', 'alumnoId'],
                include: [{ association: 'alumno', attributes: ['usuarioId'],
                        include: [{ association: 'usuario', attributes: ['identificador', 'nombreCompleto'] }],
                    }],
            }],
        order: [['id', 'ASC']], limit: limite, offset: (pagina - 1) * limite,
    });
    res.json((0, respuestas_1.lista)(filas, pagina, limite));
}
async function descargar(req, res) {
    const id = s.id.parse(req.params.id);
    const propietario = req.usuario.rol === 'ALU' ? { alumnoId: req.usuario.id } : undefined;
    const documento = (0, errors_1.encontrado)(await models_1.Documentos.findByPk(id, {
        attributes: ['id', 'archivoPdf'],
        include: [{ association: 'expediente', attributes: [], where: propietario }],
    }), 'No se encontró el documento');
    (0, respuestas_1.enviarPdf)(res, documento.archivoPdf, 'documento-' + id + '.pdf');
}
async function revisar(req, res) {
    const id = s.id.parse(req.params.id);
    const datos = s.revision.parse(req.body ?? {});
    const documento = await database_1.db.transaction(async (transaction) => {
        const original = (0, errors_1.encontrado)(await models_1.Documentos.findByPk(id, {
            attributes: ['expedienteId'], transaction,
        }), 'No se encontró el documento');
        const expediente = (0, errors_1.encontrado)(await models_1.Expedientes.findByPk(original.expedienteId, {
            lock: true, transaction,
        }), 'No se encontró el expediente');
        const documento = (0, errors_1.encontrado)(await models_1.Documentos.findByPk(id, { attributes: expedientes_1.sinArchivo, transaction }), 'No se encontró el documento');
        if (!documento.vigente || documento.estado !== 'PENDIENTE') {
            throw new errors_1.ApiError(409, 'DOCUMENTO_NO_REVISABLE', 'El documento ya fue revisado o reemplazado');
        }
        await documento.update({
            ...datos, observaciones: datos.observaciones || null,
            fechaValidacion: new Date(), revisadoPor: req.usuario.id,
        }, { transaction });
        if (datos.estado === 'ACEPTADO' && documento.horas !== null) {
            const avanceHoras = expediente.avanceHoras + documento.horas;
            await expediente.update({
                avanceHoras, porcentajeAvance: Math.min(100, 100 * avanceHoras / env_1.env.HOURS_REQUIRED).toFixed(2),
            }, { transaction });
        }
        return documento;
    });
    res.json({ mensaje: 'El estado se ha asignado exitosamente.', datos: (0, respuestas_1.vistaDocumento)(documento.get({ plain: true })) });
}
async function listarPlantillas(_req, res) {
    res.json({ datos: await models_1.Plantillas.findAll({ attributes: ['tipo'], order: [['tipo', 'ASC']] }) });
}
async function descargarPlantilla(req, res) {
    const tipo = s.tipoDocumento.parse(req.params.tipo);
    const plantilla = (0, errors_1.encontrado)(await models_1.Plantillas.findByPk(tipo), 'El archivo no se encuentra disponible');
    (0, respuestas_1.enviarPdf)(res, plantilla.archivoPdf, tipo + '.pdf');
}
async function cargarPlantilla(req, res) {
    const { tipo, archivo } = s.plantilla.parse({ ...req.body, archivo: req.file });
    await models_1.Plantillas.upsert({ tipo, archivoPdf: await (0, archivos_1.verificarPdf)(archivo), actualizadoPor: req.usuario.id });
    res.json({ mensaje: 'Plantilla guardada', datos: { tipo } });
}
