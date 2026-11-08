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
exports.banco = banco;
exports.consultarInterno = consultarInterno;
exports.crearInterno = crearInterno;
exports.editarInterno = editarInterno;
exports.archivarInterno = archivarInterno;
exports.seleccionar = seleccionar;
exports.crearExterno = crearExterno;
exports.propuestaPropia = propuestaPropia;
exports.listarExternos = listarExternos;
exports.descargarExterno = descargarExterno;
exports.revisarExterno = revisarExterno;
const errors_1 = require("../http/errors");
const models_1 = require("../models");
const archivos_1 = require("../services/archivos");
const flujo = __importStar(require("../services/programas"));
const s = __importStar(require("../validation/schemas"));
const respuestas_1 = require("../views/respuestas");
async function banco(req, res) {
    const { periodo, pagina, limite } = s.programaConsulta.parse(req.query);
    const filas = await models_1.Programas.findAndCountAll({
        where: {
            tipo: 'INTERNO',
            ...(req.usuario.rol === 'ALU' ? { activo: true } : {}),
            ...(periodo ? { periodo } : {}),
        },
        attributes: flujo.datosSinPdf, order: [['id', 'DESC']], limit: limite, offset: (pagina - 1) * limite,
    });
    res.json((0, respuestas_1.lista)(filas, pagina, limite));
}
async function consultarInterno(req, res) {
    const programa = (0, errors_1.encontrado)(await models_1.Programas.findOne({
        where: { id: s.id.parse(req.params.id), tipo: 'INTERNO', ...(req.usuario.rol === 'ALU' ? { activo: true } : {}) },
        attributes: flujo.datosSinPdf,
    }), 'No se encontró el programa');
    res.json({ datos: programa });
}
async function crearInterno(req, res) {
    const programa = await flujo.crearInterno(req.usuario.id, s.programaInterno.parse(req.body ?? {}));
    res.status(201).location('/api/programas/' + programa.id).json({
        mensaje: 'El programa ha sido subido exitosamente.', datos: (0, respuestas_1.vistaPrograma)(programa.get({ plain: true })),
    });
}
async function editarInterno(req, res) {
    const programa = await flujo.editarInterno(s.id.parse(req.params.id), s.programaInterno.parse(req.body ?? {}));
    res.json({ mensaje: 'Programa actualizado exitosamente', datos: programa });
}
async function archivarInterno(req, res) {
    await flujo.archivarInterno(s.id.parse(req.params.id));
    res.status(204).end();
}
async function seleccionar(req, res) {
    const { folio } = s.seleccion.parse(req.body ?? {});
    const expediente = await flujo.seleccionarInterno(req.usuario.id, folio);
    res.status(201).location('/api/alumnos/me/expediente').json({
        mensaje: 'Programa de servicio social seleccionado con éxito', datos: expediente,
    });
}
async function crearExterno(req, res) {
    const datos = s.programaExterno.parse(req.body ?? {});
    const archivo = req.file ? await (0, archivos_1.verificarPdf)(req.file) : undefined;
    const programa = await flujo.crearExterno(req.usuario.id, datos, archivo);
    res.status(201).location('/api/alumnos/me/propuesta').json({
        mensaje: 'Su propuesta ha sido subida exitosamente.', datos: (0, respuestas_1.vistaPrograma)(programa.get({ plain: true })),
    });
}
async function propuestaPropia(req, res) {
    const propuesta = (0, errors_1.encontrado)(await models_1.Programas.findOne({
        where: { creadoPor: req.usuario.id, tipo: 'EXTERNO' }, attributes: flujo.datosSinPdf, order: [['id', 'DESC']],
    }), 'Aún no cuenta con una propuesta propia registrada');
    res.json({ datos: propuesta });
}
async function listarExternos(req, res) {
    const { estado, pagina, limite } = s.revisiones.parse(req.query);
    const filas = await models_1.Programas.findAndCountAll({
        where: { tipo: 'EXTERNO', estado }, attributes: flujo.datosSinPdf,
        include: [{ association: 'autor', attributes: ['identificador', 'nombreCompleto'] }],
        order: [['id', 'ASC']], limit: limite, offset: (pagina - 1) * limite,
    });
    res.json((0, respuestas_1.lista)(filas, pagina, limite));
}
async function descargarExterno(req, res) {
    const propuesta = (0, errors_1.encontrado)(await models_1.Programas.findOne({
        where: { id: s.id.parse(req.params.id), tipo: 'EXTERNO' }, attributes: ['id', 'creadoPor', 'archivoPdf'],
    }), 'No se encontró la propuesta');
    if (req.usuario.rol === 'ALU' && propuesta.creadoPor !== req.usuario.id) {
        throw new errors_1.ApiError(404, 'NO_ENCONTRADO', 'No se encontró la propuesta');
    }
    (0, respuestas_1.enviarPdf)(res, (0, errors_1.encontrado)(propuesta.archivoPdf, 'El archivo no se encuentra disponible'), 'propuesta-' + propuesta.id + '.pdf');
}
async function revisarExterno(req, res) {
    const programa = await flujo.revisarExterno(s.id.parse(req.params.id), req.usuario.id, s.revision.parse(req.body ?? {}));
    res.json({ mensaje: 'El estado se ha asignado exitosamente.', datos: programa });
}
