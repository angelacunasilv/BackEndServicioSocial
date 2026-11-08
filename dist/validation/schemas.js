"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.faltantes = exports.alumnoConsulta = exports.listaControles = exports.asistencia = exports.revisiones = exports.plantilla = exports.documento = exports.tipoDocumento = exports.revision = exports.seleccion = exports.programaConsulta = exports.programaExterno = exports.programaInterno = exports.confirmarBaja = exports.buscarUsuario = exports.usuarioEditar = exports.usuarioNuevo = exports.perfil = exports.restablecer = exports.solicitarReset = exports.login = exports.paginacion = exports.id = exports.nuevaPassword = exports.identificador = exports.correoInstitucional = void 0;
const zod_1 = require("zod");
const env_1 = require("../config/env");
const constants_1 = require("../config/constants");
const requerido = { error: constants_1.mensajeObligatorio };
const faltante = (value) => value === undefined || value === null || (typeof value === 'string' && !value.trim());
const texto = (max) => zod_1.z.string(requerido).trim().min(1, requerido).max(max)
    .refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(value), 'El campo contiene caracteres de control');
const correo = texto(254).toLowerCase().pipe(zod_1.z.email({ error: 'Correo electrónico inválido' }));
exports.correoInstitucional = correo.refine(value => !env_1.env.INSTITUTIONAL_DOMAIN || value.endsWith('@' + env_1.env.INSTITUTIONAL_DOMAIN), 'Ingrese un correo institucional válido');
exports.identificador = texto(32).toUpperCase().regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Identificador inválido');
const telefono = texto(24).regex(/^\+?[\d() -]{7,24}$/, 'Teléfono inválido')
    .refine(value => { const digits = value.replace(/\D/g, '').length; return digits >= 7 && digits <= 15; }, 'Teléfono inválido');
const password = zod_1.z.string(requerido).min(1, requerido).max(128).refine(value => value.trim().length > 0, requerido);
exports.nuevaPassword = password.min(12, 'La contraseña debe tener al menos 12 caracteres');
const convertirEntero = (value) => {
    if (typeof value !== 'string')
        return value;
    if (!value.trim())
        return undefined;
    return /^-?\d+$/.test(value.trim()) ? Number(value) : value;
};
const entero = (min, max, message = 'Ingrese un número entero válido') => zod_1.z.preprocess(convertirEntero, zod_1.z.int({ error: issue => issue.input === undefined ? constants_1.mensajeObligatorio : message })
    .min(min, message).max(max, message));
exports.id = entero(1, 2147483647);
const periodo = texto(32);
exports.paginacion = {
    pagina: entero(1, 100000).default(1),
    limite: entero(1, 100).default(25),
};
exports.login = zod_1.z.strictObject({ identificador: texto(254), contrasena: password });
exports.solicitarReset = zod_1.z.strictObject({ correo: exports.correoInstitucional });
exports.restablecer = zod_1.z.strictObject({ token: zod_1.z.string(requerido).regex(/^[a-f0-9]{64}$/), contrasena: exports.nuevaPassword });
exports.perfil = zod_1.z.strictObject({
    nombre: texto(100).optional(), apellidos: texto(120).optional(), telefono: telefono.optional(),
    contrasenaActual: password, nuevaContrasena: exports.nuevaPassword.optional(),
}).refine(value => value.nombre || value.apellidos || value.telefono || value.nuevaContrasena, 'Indique al menos un dato que desee actualizar');
const datosUsuario = {
    identificador: exports.identificador, nombreCompleto: texto(221), correo: exports.correoInstitucional,
    rol: zod_1.z.enum(constants_1.roles, requerido), departamento: texto(120).optional(), carrera: texto(120).optional(),
    semestre: entero(1, 20).optional(), planEstudios: texto(120).optional(),
};
exports.usuarioNuevo = zod_1.z.strictObject({ ...datosUsuario, contrasena: exports.nuevaPassword.optional() });
exports.usuarioEditar = zod_1.z.strictObject({
    ...datosUsuario, activo: zod_1.z.boolean().optional(), contrasena: exports.nuevaPassword.optional(),
});
exports.buscarUsuario = zod_1.z.strictObject({ ...exports.paginacion, identificador: exports.identificador.optional() });
exports.confirmarBaja = zod_1.z.strictObject({ confirmar: zod_1.z.literal(true, { error: 'Confirme la baja del usuario' }) });
const datosPrograma = {
    area: texto(160), nombreTitular: texto(160), puestoTitular: texto(160),
    nombreResponsable: texto(160), puestoResponsable: texto(160),
    actividades: texto(4000), telefono, correo, domicilio: texto(300),
};
exports.programaInterno = zod_1.z.strictObject({
    ...datosPrograma, nombreProyecto: texto(200), objetivo: texto(2000),
    cupo: entero(1, 100000, 'El cupo debe ser mayor a 0'),
    horario: texto(160), periodo: periodo.optional(),
});
exports.programaExterno = zod_1.z.strictObject({ ...datosPrograma, nombreEmpresa: texto(200) });
exports.programaConsulta = zod_1.z.strictObject({ ...exports.paginacion, periodo: periodo.optional() });
exports.seleccion = zod_1.z.strictObject({ folio: exports.id });
exports.revision = zod_1.z.strictObject({
    estado: zod_1.z.enum(['ACEPTADO', 'RECHAZADO'], requerido),
    observaciones: zod_1.z.string().trim().max(2000).pipe(texto(2000).or(zod_1.z.literal(''))).optional(),
}).superRefine((value, ctx) => {
    if (value.estado === 'RECHAZADO' && !value.observaciones) {
        ctx.addIssue({ code: 'custom', path: ['observaciones'], message: 'El apartado de observaciones no puede estar vacío' });
    }
});
const errorTipoDocumento = (valor) => faltante(valor) ? constants_1.mensajeObligatorio : 'Tipo de documento inválido';
exports.tipoDocumento = zod_1.z.enum(constants_1.tiposDocumento, { error: issue => errorTipoDocumento(issue.input) });
const datosEntrega = { archivo: zod_1.z.custom(value => Boolean(value), requerido) };
exports.documento = zod_1.z.discriminatedUnion('tipo', [
    zod_1.z.strictObject({ ...datosEntrega, tipo: zod_1.z.literal('REPORTE_BIMESTRAL'), numeroReporte: entero(1, 3), horas: entero(0, 10000) }),
    zod_1.z.strictObject({ ...datosEntrega, tipo: zod_1.z.literal('REPORTE_FINAL'), horas: entero(0, 10000) }),
    zod_1.z.strictObject({ ...datosEntrega, tipo: zod_1.z.enum(['SOLICITUD', 'CARTA_ACEPTACION', 'CARTA_TERMINACION']) }),
], { error: issue => errorTipoDocumento(issue.input?.tipo) });
exports.plantilla = zod_1.z.strictObject({ tipo: exports.tipoDocumento, ...datosEntrega });
exports.revisiones = zod_1.z.strictObject({
    ...exports.paginacion, estado: zod_1.z.enum(['PENDIENTE', 'ACEPTADO', 'RECHAZADO']).default('PENDIENTE'),
});
exports.asistencia = zod_1.z.strictObject({ ...datosEntrega, periodo, fechaCurso: zod_1.z.iso.date(requerido) });
exports.listaControles = zod_1.z.array(exports.identificador).min(1, 'Incluya al menos un número de control').max(5000);
exports.alumnoConsulta = zod_1.z.strictObject({ numeroControl: exports.identificador });
exports.faltantes = zod_1.z.strictObject({
    reporte: zod_1.z.enum(['1', '2', '3', 'final'], requerido), periodo: periodo.optional(),
    formato: zod_1.z.enum(['json', 'csv']).default('json'), ...exports.paginacion,
});
