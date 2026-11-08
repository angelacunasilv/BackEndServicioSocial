"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiereRol = exports.sesiones = exports.store = void 0;
exports.iniciarSesion = iniciarSesion;
exports.cerrarSesion = cerrarSesion;
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const env_1 = require("../config/env");
const database_1 = require("../config/database");
const models_1 = require("../models");
const crypto_1 = require("../services/crypto");
const errors_1 = require("./errors");
const cookieName = env_1.env.NODE_ENV === 'production' ? '__Host-servicio.sid' : 'servicio.sid';
const cookie = {
    path: '/', httpOnly: true, sameSite: 'lax', secure: env_1.env.NODE_ENV === 'production',
};
const PgStore = (0, connect_pg_simple_1.default)(express_session_1.default);
exports.store = new PgStore({
    conObject: { ...database_1.connection, connectionTimeoutMillis: 2000, statement_timeout: 2500 },
    tableName: 'sesiones',
    errorLog: () => console.error('Error en el almacén de sesiones'),
});
exports.sesiones = (0, express_session_1.default)({
    name: cookieName,
    secret: env_1.env.SESSION_SECRET,
    store: exports.store,
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookie, maxAge: 8 * 60 * 60 * 1000 },
});
async function iniciarSesion(req, usuario) {
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.usuarioId = usuario.id;
    req.session.versionSesion = usuario.versionSesion;
    req.session.csrfToken = (0, crypto_1.tokenAleatorio)();
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return req.session.csrfToken;
}
async function cerrarSesion(req, res) {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(cookieName, cookie);
}
const requiereRol = (...roles) => async (req, _res, next) => {
    const usuario = req.session.usuarioId ? await models_1.Usuarios.findByPk(req.session.usuarioId, {
        attributes: { exclude: ['passwordHash'] },
    }) : null;
    if (!usuario?.activo || usuario.versionSesion !== req.session.versionSesion) {
        throw new errors_1.ApiError(401, 'SESION_REQUERIDA', 'Inicie sesión');
    }
    if (roles.length && !roles.includes(usuario.rol)) {
        throw new errors_1.ApiError(403, 'ROL_NO_AUTORIZADO', 'Su rol no tiene acceso a esta operación');
    }
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const token = req.get('X-CSRF-Token');
        if (!token || !req.session.csrfToken || !(0, crypto_1.tokensIguales)(token, req.session.csrfToken)) {
            throw new errors_1.ApiError(403, 'CSRF_INVALIDO', 'El token de seguridad de la sesión es inválido');
        }
    }
    req.usuario = usuario.get({ plain: true });
    next();
};
exports.requiereRol = requiereRol;
