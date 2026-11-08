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
exports.cargar = cargar;
const node_crypto_1 = require("node:crypto");
const sync_1 = require("csv-parse/sync");
const database_1 = require("../config/database");
const errors_1 = require("../http/errors");
const models_1 = require("../models");
const s = __importStar(require("../validation/schemas"));
async function leerControles(archivo) {
    let filas;
    try {
        if (/\.csv$/i.test(archivo.originalname)) {
            filas = (0, sync_1.parse)(archivo.buffer, { bom: true, skip_empty_lines: true, max_record_size: 256 });
        }
        else if (/\.xlsx$/i.test(archivo.originalname)) {
            // Limita el tamaño de la hoja antes de procesar archivos de asistencia.
            if (archivo.size > 1024 * 1024)
                throw new Error('Excel demasiado grande');
            const { readSheet } = await import('read-excel-file/node');
            filas = await readSheet(archivo.buffer);
        }
        else {
            throw new Error('Extensión inválida');
        }
    }
    catch {
        throw new errors_1.ApiError(400, 'LISTA_INVALIDA', 'Formato de archivo no válido. Suba un archivo Excel o CSV');
    }
    const controles = filas.map(fila => typeof fila[0] === 'number' ? String(fila[0]) : fila[0]);
    if (typeof controles[0] === 'string' && controles[0].trim().toLowerCase() === 'numero_control')
        controles.shift();
    return [...new Set(s.listaControles.parse(controles))];
}
async function cargar(req, res) {
    const { archivo, fechaCurso, periodo } = s.asistencia.parse({ ...req.body, archivo: req.file });
    const controles = await leerControles(archivo);
    const resultado = await database_1.db.transaction(async (transaction) => {
        const cuentas = await models_1.Usuarios.findAll({
            where: { identificador: controles, rol: 'ALU', activo: true }, attributes: ['id', 'identificador'],
            order: [['id', 'ASC']], lock: true, transaction,
        });
        const existentes = new Set(cuentas.map(cuenta => cuenta.identificador));
        const faltan = controles.filter(control => !existentes.has(control));
        if (faltan.length) {
            throw new errors_1.ApiError(400, 'ALUMNOS_NO_ENCONTRADOS', 'Algunos números de control no corresponden a alumnos activos', faltan);
        }
        const [curso] = await models_1.Cursos.findOrCreate({
            where: { fechaCurso, periodo }, defaults: { codigoQr: (0, node_crypto_1.randomUUID)(), creadoPor: req.usuario.id }, transaction,
        });
        const ids = cuentas.map(cuenta => cuenta.id);
        await models_1.Asistencias.bulkCreate(ids.map(alumnoId => ({ alumnoId, cursoId: curso.id })), { ignoreDuplicates: true, transaction });
        await models_1.Alumnos.update({ cursoInduccionAcreditado: true }, { where: { usuarioId: ids }, transaction });
        return { curso, totalAsistentes: await models_1.Asistencias.count({ where: { cursoId: curso.id }, transaction }) };
    });
    res.json({ mensaje: 'Lista de asistencia cargada y alumnos habilitados exitosamente', datos: resultado });
}
