"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baja = void 0;
exports.alta = alta;
exports.editar = editar;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const errors_1 = require("../http/errors");
const models_1 = require("../models");
const crypto_1 = require("./crypto");
const duplicado = () => new errors_1.ApiError(409, 'USUARIO_DUPLICADO', 'El usuario ya se encuentra registrado');
async function guardarPerfil(id, datos, transaction, renombrar = true) {
    if (datos.rol === 'ALU') {
        const alumno = await models_1.Alumnos.findByPk(id, { transaction, lock: true });
        const [nombre, ...apellidos] = datos.nombreCompleto.split(/\s+/);
        const perfil = { carrera: datos.carrera, semestre: datos.semestre, planEstudios: datos.planEstudios };
        if (alumno) {
            await alumno.update(renombrar ? { ...perfil, nombre, apellidos: apellidos.join(' ') } : perfil, { transaction });
        }
        else {
            await models_1.Alumnos.create({ usuarioId: id, nombre, apellidos: apellidos.join(' '), ...perfil }, { transaction });
        }
    }
    else {
        const [personal] = await models_1.Personal.findOrCreate({ where: { usuarioId: id }, transaction });
        if (datos.departamento !== undefined)
            await personal.update({ departamento: datos.departamento }, { transaction });
    }
}
async function alta(datos) {
    const contrasenaInicial = datos.contrasena ? undefined : (0, crypto_1.tokenAleatorio)();
    const passwordHash = await (0, crypto_1.hashPassword)(datos.contrasena ?? contrasenaInicial);
    try {
        const usuario = await database_1.db.transaction(async (transaction) => {
            const cuenta = await models_1.Usuarios.create({
                identificador: datos.identificador, nombreCompleto: datos.nombreCompleto,
                correo: datos.correo, rol: datos.rol, passwordHash,
            }, { transaction });
            await guardarPerfil(cuenta.id, datos, transaction);
            return cuenta;
        });
        return { usuario, contrasenaInicial };
    }
    catch (error) {
        if (error instanceof sequelize_1.UniqueConstraintError)
            throw duplicado();
        throw error;
    }
}
async function cambiosAdministrativos(id, aplicar) {
    try {
        return await database_1.db.transaction(async (transaction) => {
            // Serializa bajas y cambios de rol para conservar al menos un administrador activo.
            await database_1.db.query('SELECT pg_advisory_xact_lock(683103223)', { transaction });
            const cuenta = (0, errors_1.encontrado)(await models_1.Usuarios.findByPk(id, { transaction, lock: true }), 'No se encontró el usuario');
            const datos = await aplicar(cuenta, transaction);
            if (cuenta.activo && cuenta.rol === 'ADM' && (datos.activo === false || (datos.rol && datos.rol !== 'ADM'))) {
                const administradores = await models_1.Usuarios.count({ where: { activo: true, rol: 'ADM' }, transaction });
                if (administradores <= 1)
                    throw new errors_1.ApiError(409, 'ULTIMO_ADMIN', 'Debe quedar un administrador activo');
            }
            await cuenta.update({ ...datos, versionSesion: cuenta.versionSesion + 1 }, { transaction });
            await models_1.Recuperaciones.destroy({ where: { usuarioId: id }, transaction });
            return cuenta;
        });
    }
    catch (error) {
        if (error instanceof sequelize_1.UniqueConstraintError)
            throw duplicado();
        throw error;
    }
}
async function editar(id, datos) {
    const passwordHash = datos.contrasena ? await (0, crypto_1.hashPassword)(datos.contrasena) : undefined;
    return cambiosAdministrativos(id, async (cuenta, transaction) => {
        await guardarPerfil(id, datos, transaction, cuenta.nombreCompleto !== datos.nombreCompleto);
        const { identificador, nombreCompleto, correo, rol, activo } = datos;
        return { identificador, nombreCompleto, correo, rol, activo, passwordHash };
    });
}
const baja = (id) => cambiosAdministrativos(id, async () => ({ activo: false }));
exports.baja = baja;
