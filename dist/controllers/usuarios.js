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
exports.listar = listar;
exports.consultar = consultar;
exports.crear = crear;
exports.editar = editar;
exports.baja = baja;
const errors_1 = require("../http/errors");
const models_1 = require("../models");
const usuarios = __importStar(require("../services/usuarios"));
const s = __importStar(require("../validation/schemas"));
const respuestas_1 = require("../views/respuestas");
async function listar(req, res) {
    const { identificador, pagina, limite } = s.buscarUsuario.parse(req.query);
    const filas = await models_1.Usuarios.findAndCountAll({
        where: identificador ? { identificador } : undefined,
        attributes: { exclude: ['passwordHash', 'versionSesion'] },
        order: [['id', 'ASC']], limit: limite, offset: (pagina - 1) * limite,
    });
    res.json((0, respuestas_1.lista)({ rows: filas.rows.map(respuestas_1.vistaUsuario), count: filas.count }, pagina, limite));
}
async function consultar(req, res) {
    const cuenta = (0, errors_1.encontrado)(await models_1.Usuarios.findByPk(s.id.parse(req.params.id), {
        attributes: { exclude: ['passwordHash', 'versionSesion'] },
    }), 'No se encontró el usuario');
    const perfil = cuenta.rol === 'ALU' ? await models_1.Alumnos.findByPk(cuenta.id) : await models_1.Personal.findByPk(cuenta.id);
    res.json({ datos: { ...(0, respuestas_1.vistaUsuario)(cuenta), perfil } });
}
async function crear(req, res) {
    const { usuario, contrasenaInicial } = await usuarios.alta(s.usuarioNuevo.parse(req.body ?? {}));
    res.status(201).location('/api/usuarios/' + usuario.id).json({
        mensaje: 'Acceso creado con éxito', datos: (0, respuestas_1.vistaUsuario)(usuario), contrasenaInicial,
    });
}
async function editar(req, res) {
    const cuenta = await usuarios.editar(s.id.parse(req.params.id), s.usuarioEditar.parse(req.body ?? {}));
    res.json({ mensaje: 'Usuario actualizado exitosamente', datos: (0, respuestas_1.vistaUsuario)(cuenta) });
}
async function baja(req, res) {
    s.confirmarBaja.parse(req.body ?? {});
    await usuarios.baja(s.id.parse(req.params.id));
    res.json({ mensaje: 'Usuario dado de baja con éxito' });
}
