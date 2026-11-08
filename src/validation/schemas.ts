import { z } from 'zod';
import { env } from '../config/env';
import { mensajeObligatorio, roles, tiposDocumento } from '../config/constants';

const requerido = { error: mensajeObligatorio };
const faltante = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && !value.trim());
const texto = (max: number) => z.string(requerido).trim().min(1, requerido).max(max)
  .refine(value => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(value), 'El campo contiene caracteres de control');
const correo = texto(254).toLowerCase().pipe(z.email({ error: 'Correo electrónico inválido' }));
export const correoInstitucional = correo.refine(
  value => !env.INSTITUTIONAL_DOMAIN || value.endsWith('@' + env.INSTITUTIONAL_DOMAIN),
  'Ingrese un correo institucional válido',
);
export const identificador = texto(32).toUpperCase().regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Identificador inválido');
const telefono = texto(24).regex(/^\+?[\d() -]{7,24}$/, 'Teléfono inválido')
  .refine(value => { const digits = value.replace(/\D/g, '').length; return digits >= 7 && digits <= 15; }, 'Teléfono inválido');
const password = z.string(requerido).min(1, requerido).max(128).refine(value => value.trim().length > 0, requerido);
export const nuevaPassword = password.min(12, 'La contraseña debe tener al menos 12 caracteres');

const convertirEntero = (value: unknown) => {
  if (typeof value !== 'string') return value;
  if (!value.trim()) return undefined;
  return /^-?\d+$/.test(value.trim()) ? Number(value) : value;
};
const entero = (min: number, max: number, message = 'Ingrese un número entero válido') =>
  z.preprocess(convertirEntero, z.int({ error: issue => issue.input === undefined ? mensajeObligatorio : message })
    .min(min, message).max(max, message));
export const id = entero(1, 2147483647);
const periodo = texto(32);
export const paginacion = {
  pagina: entero(1, 100000).default(1),
  limite: entero(1, 100).default(25),
};
export const login = z.strictObject({ identificador: texto(254), contrasena: password });
export const solicitarReset = z.strictObject({ correo: correoInstitucional });
export const restablecer = z.strictObject({ token: z.string(requerido).regex(/^[a-f0-9]{64}$/), contrasena: nuevaPassword });
export const perfil = z.strictObject({
  nombre: texto(100).optional(), apellidos: texto(120).optional(), telefono: telefono.optional(),
  contrasenaActual: password, nuevaContrasena: nuevaPassword.optional(),
}).refine(value => value.nombre || value.apellidos || value.telefono || value.nuevaContrasena,
  'Indique al menos un dato que desee actualizar');

const datosUsuario = {
  identificador, nombreCompleto: texto(221), correo: correoInstitucional,
  rol: z.enum(roles, requerido), departamento: texto(120).optional(), carrera: texto(120).optional(),
  semestre: entero(1, 20).optional(), planEstudios: texto(120).optional(),
};
export const usuarioNuevo = z.strictObject({ ...datosUsuario, contrasena: nuevaPassword.optional() });
export const usuarioEditar = z.strictObject({
  ...datosUsuario, activo: z.boolean().optional(), contrasena: nuevaPassword.optional(),
});
export const buscarUsuario = z.strictObject({ ...paginacion, identificador: identificador.optional() });
export const confirmarBaja = z.strictObject({ confirmar: z.literal(true, { error: 'Confirme la baja del usuario' }) });

const datosPrograma = {
  area: texto(160), nombreTitular: texto(160), puestoTitular: texto(160),
  nombreResponsable: texto(160), puestoResponsable: texto(160),
  actividades: texto(4000), telefono, correo, domicilio: texto(300),
};
export const programaInterno = z.strictObject({
  ...datosPrograma, nombreProyecto: texto(200), objetivo: texto(2000),
  cupo: entero(1, 100000, 'El cupo debe ser mayor a 0'),
  horario: texto(160), periodo: periodo.optional(),
});
export const programaExterno = z.strictObject({ ...datosPrograma, nombreEmpresa: texto(200) });
export const programaConsulta = z.strictObject({ ...paginacion, periodo: periodo.optional() });
export const seleccion = z.strictObject({ folio: id });
export const revision = z.strictObject({
  estado: z.enum(['ACEPTADO', 'RECHAZADO'], requerido),
  observaciones: z.string().trim().max(2000).pipe(texto(2000).or(z.literal(''))).optional(),
}).superRefine((value, ctx) => {
  if (value.estado === 'RECHAZADO' && !value.observaciones) {
    ctx.addIssue({ code: 'custom', path: ['observaciones'], message: 'El apartado de observaciones no puede estar vacío' });
  }
});

const errorTipoDocumento = (valor: unknown) => faltante(valor) ? mensajeObligatorio : 'Tipo de documento inválido';
export const tipoDocumento = z.enum(tiposDocumento, { error: issue => errorTipoDocumento(issue.input) });
const datosEntrega = { archivo: z.custom<Express.Multer.File>(value => Boolean(value), requerido) };
export const documento = z.discriminatedUnion('tipo', [
  z.strictObject({ ...datosEntrega, tipo: z.literal('REPORTE_BIMESTRAL'), numeroReporte: entero(1, 3), horas: entero(0, 10000) }),
  z.strictObject({ ...datosEntrega, tipo: z.literal('REPORTE_FINAL'), horas: entero(0, 10000) }),
  z.strictObject({ ...datosEntrega, tipo: z.enum(['SOLICITUD', 'CARTA_ACEPTACION', 'CARTA_TERMINACION']) }),
], { error: issue => errorTipoDocumento((issue.input as { tipo?: unknown } | undefined)?.tipo) });
export const plantilla = z.strictObject({ tipo: tipoDocumento, ...datosEntrega });
export const revisiones = z.strictObject({
  ...paginacion, estado: z.enum(['PENDIENTE', 'ACEPTADO', 'RECHAZADO']).default('PENDIENTE'),
});
export const asistencia = z.strictObject({ ...datosEntrega, periodo, fechaCurso: z.iso.date(requerido) });
export const listaControles = z.array(identificador).min(1, 'Incluya al menos un número de control').max(5000);
export const alumnoConsulta = z.strictObject({ numeroControl: identificador });
export const faltantes = z.strictObject({
  reporte: z.enum(['1', '2', '3', 'final'], requerido), periodo: periodo.optional(),
  formato: z.enum(['json', 'csv']).default('json'), ...paginacion,
});
