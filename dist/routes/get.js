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
exports.getRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../config/database");
const auth = __importStar(require("../controllers/auth"));
const documentos = __importStar(require("../controllers/documentos"));
const expedientes = __importStar(require("../controllers/expedientes"));
const programas = __importStar(require("../controllers/programas"));
const reportes_1 = require("../controllers/reportes");
const usuarios = __importStar(require("../controllers/usuarios"));
const errors_1 = require("../http/errors");
const session_1 = require("../http/session");
exports.getRoutes = (0, express_1.Router)();
exports.getRoutes.get('/salud', async (_req, res) => {
    try {
        await database_1.db.authenticate();
    }
    catch {
        throw new errors_1.ApiError(503, 'BASE_NO_DISPONIBLE', 'La base de datos no está disponible');
    }
    res.json({ estado: 'ok' });
});
exports.getRoutes.get('/auth/sesion', (0, session_1.requiereRol)(), auth.sesion);
exports.getRoutes.get('/usuarios', (0, session_1.requiereRol)('ADM'), usuarios.listar);
exports.getRoutes.get('/usuarios/:id', (0, session_1.requiereRol)('ADM'), usuarios.consultar);
exports.getRoutes.get('/alumnos/me/perfil', (0, session_1.requiereRol)('ALU'), auth.consultarPerfil);
exports.getRoutes.get('/alumnos/me/propuesta', (0, session_1.requiereRol)('ALU'), programas.propuestaPropia);
exports.getRoutes.get('/alumnos/me/expediente', (0, session_1.requiereRol)('ALU'), expedientes.mio);
exports.getRoutes.get('/programas', (0, session_1.requiereRol)('ALU', 'JSS'), programas.banco);
exports.getRoutes.get('/programas/:id', (0, session_1.requiereRol)('ALU', 'JSS'), programas.consultarInterno);
exports.getRoutes.get('/propuestas', (0, session_1.requiereRol)('JSS'), programas.listarExternos);
exports.getRoutes.get('/propuestas/:id/archivo', (0, session_1.requiereRol)('ALU', 'JSS'), programas.descargarExterno);
exports.getRoutes.get('/documentos', (0, session_1.requiereRol)('JSS'), documentos.listar);
exports.getRoutes.get('/documentos/:id/archivo', (0, session_1.requiereRol)('ALU', 'JSS', 'JDV'), documentos.descargar);
exports.getRoutes.get('/plantillas', (0, session_1.requiereRol)('ALU', 'JSS'), documentos.listarPlantillas);
exports.getRoutes.get('/plantillas/:tipo', (0, session_1.requiereRol)('ALU', 'JSS'), documentos.descargarPlantilla);
exports.getRoutes.get('/reportes/faltantes', (0, session_1.requiereRol)('JSS'), reportes_1.reporteFaltantes);
exports.getRoutes.get('/expedientes', (0, session_1.requiereRol)('JDV'), expedientes.consultar);
exports.getRoutes.get('/constancias/:folio/archivo', (0, session_1.requiereRol)('JDV'), expedientes.descargar);
