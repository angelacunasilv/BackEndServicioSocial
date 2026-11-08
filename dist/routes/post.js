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
exports.postRoutes = void 0;
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const auth = __importStar(require("../controllers/auth"));
const documentos_1 = require("../controllers/documentos");
const expedientes_1 = require("../controllers/expedientes");
const induccion_1 = require("../controllers/induccion");
const programas = __importStar(require("../controllers/programas"));
const usuarios_1 = require("../controllers/usuarios");
const errors_1 = require("../http/errors");
const session_1 = require("../http/session");
const upload_1 = require("../http/upload");
function limitar(limit, windowMs) {
    return (0, express_rate_limit_1.rateLimit)({
        limit, windowMs, standardHeaders: 'draft-8', legacyHeaders: false,
        handler: (_req, _res, next) => next(new errors_1.ApiError(429, 'DEMASIADAS_SOLICITUDES', 'Intente nuevamente más tarde')),
    });
}
exports.postRoutes = (0, express_1.Router)();
exports.postRoutes.post('/auth/login', limitar(30, 5 * 60_000), auth.login);
exports.postRoutes.post('/auth/recuperar', limitar(10, 15 * 60_000), auth.recuperar);
exports.postRoutes.post('/auth/restablecer', limitar(15, 15 * 60_000), auth.restablecer);
exports.postRoutes.post('/auth/logout', (0, session_1.requiereRol)(), auth.logout);
exports.postRoutes.post('/usuarios', (0, session_1.requiereRol)('ADM'), usuarios_1.crear);
exports.postRoutes.post('/induccion/asistencias', (0, session_1.requiereRol)('JSS'), upload_1.adjuntar, induccion_1.cargar);
exports.postRoutes.post('/programas', (0, session_1.requiereRol)('JSS'), programas.crearInterno);
exports.postRoutes.post('/alumnos/me/seleccion', (0, session_1.requiereRol)('ALU'), programas.seleccionar);
exports.postRoutes.post('/alumnos/me/propuesta', (0, session_1.requiereRol)('ALU'), upload_1.adjuntar, programas.crearExterno);
exports.postRoutes.post('/documentos', (0, session_1.requiereRol)('ALU'), upload_1.adjuntar, documentos_1.subir);
exports.postRoutes.post('/constancias', (0, session_1.requiereRol)('JDV'), expedientes_1.emitir);
