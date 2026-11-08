"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Constancias = exports.Plantillas = exports.Documentos = exports.Expedientes = exports.Programas = exports.Asistencias = exports.Cursos = exports.Recuperaciones = exports.Alumnos = exports.Personal = exports.Usuarios = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
function modelo(tabla, atributos) {
    return database_1.db.define(tabla, atributos, { underscored: true });
}
const pk = () => ({ type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true });
const fk = (primaryKey = false) => ({ type: sequelize_1.DataTypes.INTEGER, primaryKey, allowNull: false });
exports.Usuarios = modelo('usuarios', {
    id: pk(), identificador: sequelize_1.DataTypes.STRING, nombreCompleto: sequelize_1.DataTypes.STRING, correo: sequelize_1.DataTypes.STRING,
    passwordHash: sequelize_1.DataTypes.STRING, rol: sequelize_1.DataTypes.STRING, activo: sequelize_1.DataTypes.BOOLEAN, versionSesion: sequelize_1.DataTypes.INTEGER, fechaCreacion: sequelize_1.DataTypes.DATE,
});
exports.Personal = modelo('personal', {
    usuarioId: fk(true), departamento: sequelize_1.DataTypes.STRING,
});
exports.Alumnos = modelo('alumnos', {
    usuarioId: fk(true), nombre: sequelize_1.DataTypes.STRING, apellidos: sequelize_1.DataTypes.STRING, carrera: sequelize_1.DataTypes.STRING, semestre: sequelize_1.DataTypes.INTEGER,
    telefono: sequelize_1.DataTypes.STRING, planEstudios: sequelize_1.DataTypes.STRING, cursoInduccionAcreditado: sequelize_1.DataTypes.BOOLEAN,
});
exports.Recuperaciones = modelo('recuperaciones', {
    usuarioId: fk(true), hash: sequelize_1.DataTypes.CHAR(64), venceEn: sequelize_1.DataTypes.DATE,
});
exports.Cursos = modelo('cursos_induccion', { id: pk(), fechaCurso: sequelize_1.DataTypes.DATEONLY, periodo: sequelize_1.DataTypes.STRING, codigoQr: sequelize_1.DataTypes.UUID, creadoPor: fk() });
exports.Asistencias = modelo('asistencias_induccion', {
    cursoId: fk(true), alumnoId: fk(true),
});
exports.Programas = modelo('programas', {
    id: pk(), tipo: sequelize_1.DataTypes.STRING, creadoPor: fk(), nombreProyecto: sequelize_1.DataTypes.STRING, area: sequelize_1.DataTypes.STRING,
    nombreTitular: sequelize_1.DataTypes.STRING, puestoTitular: sequelize_1.DataTypes.STRING, nombreResponsable: sequelize_1.DataTypes.STRING, puestoResponsable: sequelize_1.DataTypes.STRING,
    actividades: sequelize_1.DataTypes.TEXT, telefono: sequelize_1.DataTypes.STRING, correo: sequelize_1.DataTypes.STRING, domicilio: sequelize_1.DataTypes.STRING, periodo: sequelize_1.DataTypes.STRING,
    objetivo: sequelize_1.DataTypes.TEXT, horario: sequelize_1.DataTypes.STRING, cupo: sequelize_1.DataTypes.INTEGER, cupoDisponible: sequelize_1.DataTypes.INTEGER, activo: sequelize_1.DataTypes.BOOLEAN,
    estado: sequelize_1.DataTypes.STRING, observaciones: sequelize_1.DataTypes.TEXT, archivoPdf: sequelize_1.DataTypes.BLOB, revisadoPor: sequelize_1.DataTypes.INTEGER,
    fechaRevision: sequelize_1.DataTypes.DATE, fechaEnvio: sequelize_1.DataTypes.DATE,
});
exports.Expedientes = modelo('expedientes', {
    id: pk(), alumnoId: fk(), programaId: fk(), avanceHoras: sequelize_1.DataTypes.INTEGER, porcentajeAvance: sequelize_1.DataTypes.DECIMAL(5, 2),
    estadoGlobal: sequelize_1.DataTypes.STRING, fechaInscripcion: sequelize_1.DataTypes.DATE,
});
exports.Documentos = modelo('documentos', {
    id: pk(), expedienteId: fk(), tipo: sequelize_1.DataTypes.STRING, numeroReporte: sequelize_1.DataTypes.INTEGER, horas: sequelize_1.DataTypes.INTEGER,
    nombreArchivo: sequelize_1.DataTypes.STRING, archivoPdf: sequelize_1.DataTypes.BLOB, extension: sequelize_1.DataTypes.STRING, tamano: sequelize_1.DataTypes.INTEGER, vigente: sequelize_1.DataTypes.BOOLEAN,
    estado: sequelize_1.DataTypes.STRING, observaciones: sequelize_1.DataTypes.TEXT, fechaSubida: sequelize_1.DataTypes.DATE, fechaValidacion: sequelize_1.DataTypes.DATE, revisadoPor: sequelize_1.DataTypes.INTEGER,
});
exports.Plantillas = modelo('plantillas', {
    tipo: { type: sequelize_1.DataTypes.STRING, primaryKey: true }, archivoPdf: sequelize_1.DataTypes.BLOB, actualizadoPor: fk(),
});
exports.Constancias = modelo('constancias_terminacion', {
    folio: { type: sequelize_1.DataTypes.UUID, primaryKey: true }, expedienteId: fk(), emitidaPor: fk(),
    fechaEmision: sequelize_1.DataTypes.DATE, firmado: sequelize_1.DataTypes.BOOLEAN, archivoPdf: sequelize_1.DataTypes.BLOB,
});
exports.Alumnos.belongsTo(exports.Usuarios, { foreignKey: 'usuarioId', as: 'usuario' });
exports.Expedientes.belongsTo(exports.Alumnos, { foreignKey: 'alumnoId', as: 'alumno' });
exports.Expedientes.belongsTo(exports.Programas, { foreignKey: 'programaId', as: 'programa' });
exports.Documentos.belongsTo(exports.Expedientes, { foreignKey: 'expedienteId', as: 'expediente' });
exports.Constancias.belongsTo(exports.Expedientes, { foreignKey: 'expedienteId', as: 'expediente' });
exports.Programas.belongsTo(exports.Usuarios, { foreignKey: 'creadoPor', as: 'autor' });
