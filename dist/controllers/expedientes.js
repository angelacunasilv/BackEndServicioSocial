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
exports.mio = mio;
exports.consultar = consultar;
exports.emitir = emitir;
exports.descargar = descargar;
const zod_1 = require("zod");
const models_1 = require("../models");
const errors_1 = require("../http/errors");
const expedientes = __importStar(require("../services/expedientes"));
const s = __importStar(require("../validation/schemas"));
const respuestas_1 = require("../views/respuestas");
async function mio(req, res) {
    res.json({ datos: await expedientes.consultar(req.usuario.id) });
}
async function consultar(req, res) {
    const { numeroControl } = s.alumnoConsulta.parse(req.query);
    res.json({ datos: await expedientes.consultarAlumno(numeroControl) });
}
async function emitir(req, res) {
    const { numeroControl } = s.alumnoConsulta.parse(req.body ?? {});
    const { id, nombreCompleto } = req.usuario;
    const { constancia, nueva } = await expedientes.emitir(numeroControl, id, nombreCompleto);
    const { folio, fechaEmision, firmado } = constancia;
    const url = '/api/constancias/' + folio + '/archivo';
    res.status(nueva ? 201 : 200).location(url).json({
        mensaje: 'Constancia de terminación generada con éxito.',
        datos: { folio, fechaEmision, firmado, descarga: url, vistaPrevia: url + '?vista=1' },
    });
}
async function descargar(req, res) {
    const folio = zod_1.z.uuid().parse(req.params.folio);
    const { vista } = zod_1.z.strictObject({ vista: zod_1.z.literal('1').optional() }).parse(req.query);
    const constancia = (0, errors_1.encontrado)(await models_1.Constancias.findByPk(folio), 'No se encontró la constancia');
    (0, respuestas_1.enviarPdf)(res, constancia.archivoPdf, 'constancia-' + folio + '.pdf', !vista);
}
