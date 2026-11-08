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
exports.login = login;
exports.sesion = sesion;
exports.logout = logout;
exports.recuperar = recuperar;
exports.restablecer = restablecer;
exports.consultarPerfil = consultarPerfil;
exports.actualizarPerfil = actualizarPerfil;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const errors_1 = require("../http/errors");
const session_1 = require("../http/session");
const models_1 = require("../models");
const correo_1 = require("../services/correo");
const crypto_1 = require("../services/crypto");
const s = __importStar(require("../validation/schemas"));
const respuestas_1 = require("../views/respuestas");
async function login(req, res) {
    const { identificador, contrasena } = s.login.parse(req.body ?? {});
    const usuario = await models_1.Usuarios.findOne({ where: identificador.includes('@')
            ? { correo: identificador.toLowerCase() } : { identificador: identificador.toUpperCase() } });
    const valida = await (0, crypto_1.passwordCorrecta)(contrasena, usuario?.passwordHash);
    if (!usuario?.activo || !valida) {
        throw new errors_1.ApiError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales incorrectas, verifique su información');
    }
    const csrfToken = await (0, session_1.iniciarSesion)(req, usuario);
    res.json({ datos: (0, respuestas_1.vistaUsuario)(usuario), csrfToken });
}
function sesion(req, res) {
    res.json({ datos: (0, respuestas_1.vistaUsuario)(req.usuario), csrfToken: req.session.csrfToken });
}
async function logout(req, res) {
    await (0, session_1.cerrarSesion)(req, res);
    res.status(204).end();
}
async function recuperar(req, res) {
    const { correo } = s.solicitarReset.parse(req.body ?? {});
    const token = (0, crypto_1.tokenAleatorio)();
    const hash = (0, crypto_1.hashToken)(token);
    const usuarioId = await database_1.db.transaction(async (transaction) => {
        const usuario = (0, errors_1.encontrado)(await models_1.Usuarios.findOne({
            where: { correo, activo: true, rol: 'ALU' }, transaction, lock: true,
        }), 'Este correo no está registrado');
        await models_1.Recuperaciones.upsert({ usuarioId: usuario.id, hash, venceEn: new Date(Date.now() + 1800000) }, { transaction });
        return usuario.id;
    });
    try {
        await (0, correo_1.enviarRecuperacion)(correo, token);
    }
    catch {
        await models_1.Recuperaciones.destroy({ where: { usuarioId, hash } });
        throw new errors_1.ApiError(503, 'CORREO_NO_DISPONIBLE', 'No fue posible enviar el correo de recuperación');
    }
    res.json({ mensaje: 'Correo de recuperación de contraseña enviado al correo proporcionado' });
}
async function restablecer(req, res) {
    const { token, contrasena } = s.restablecer.parse(req.body ?? {});
    const hash = (0, crypto_1.hashToken)(token);
    const errorToken = () => new errors_1.ApiError(400, 'TOKEN_INVALIDO', 'El enlace es inválido o ha vencido');
    const recuperacion = await models_1.Recuperaciones.findOne({ where: { hash, venceEn: { [sequelize_1.Op.gt]: new Date() } } });
    if (!recuperacion)
        throw errorToken();
    const passwordHash = await (0, crypto_1.hashPassword)(contrasena);
    await database_1.db.transaction(async (transaction) => {
        const cuenta = await models_1.Usuarios.findByPk(recuperacion.usuarioId, { transaction, lock: true });
        if (!cuenta?.activo || cuenta.rol !== 'ALU')
            throw errorToken();
        const borradas = await models_1.Recuperaciones.destroy({
            where: { usuarioId: cuenta.id, hash, venceEn: { [sequelize_1.Op.gt]: new Date() } }, transaction,
        });
        if (!borradas)
            throw errorToken();
        await cuenta.update({ passwordHash, versionSesion: cuenta.versionSesion + 1 }, { transaction });
    });
    res.json({ mensaje: 'Contraseña restablecida correctamente' });
}
async function consultarPerfil(req, res) {
    const perfil = (0, errors_1.encontrado)(await models_1.Alumnos.findByPk(req.usuario.id), 'No se encontró el alumno');
    res.json({ datos: { ...(0, respuestas_1.vistaUsuario)(req.usuario), perfil } });
}
async function actualizarPerfil(req, res) {
    const { contrasenaActual, nuevaContrasena, nombre, apellidos, telefono } = s.perfil.parse(req.body ?? {});
    const actual = (0, errors_1.encontrado)(await models_1.Usuarios.findByPk(req.usuario.id), 'No se encontró el alumno');
    if (!await (0, crypto_1.passwordCorrecta)(contrasenaActual, actual.passwordHash)) {
        throw new errors_1.ApiError(400, 'CONTRASENA_INCORRECTA', 'La contraseña actual es incorrecta');
    }
    const passwordHash = nuevaContrasena ? await (0, crypto_1.hashPassword)(nuevaContrasena) : undefined;
    const resultado = await database_1.db.transaction(async (transaction) => {
        const cuenta = (0, errors_1.encontrado)(await models_1.Usuarios.findByPk(actual.id, { transaction, lock: true }), 'No se encontró el alumno');
        if (!cuenta.activo || cuenta.rol !== 'ALU' || cuenta.versionSesion !== req.session.versionSesion) {
            throw new errors_1.ApiError(401, 'SESION_REQUERIDA', 'Inicie sesión');
        }
        const alumno = (0, errors_1.encontrado)(await models_1.Alumnos.findByPk(cuenta.id, { transaction, lock: true }), 'No se encontró el alumno');
        await alumno.update({ nombre, apellidos, telefono }, { transaction });
        if (nombre || apellidos)
            await cuenta.update({ nombreCompleto: [alumno.nombre, alumno.apellidos].filter(Boolean).join(' ') }, { transaction });
        if (passwordHash) {
            await cuenta.update({ passwordHash, versionSesion: cuenta.versionSesion + 1 }, { transaction });
            await models_1.Recuperaciones.destroy({ where: { usuarioId: cuenta.id }, transaction });
        }
        return { cuenta, alumno };
    });
    const csrfToken = passwordHash ? await (0, session_1.iniciarSesion)(req, resultado.cuenta) : req.session.csrfToken;
    res.json({ mensaje: 'Datos actualizados exitosamente', datos: { ...(0, respuestas_1.vistaUsuario)(resultado.cuenta), perfil: resultado.alumno }, csrfToken });
}
