import { DataTypes as D, Model, ModelAttributes, ModelStatic } from 'sequelize';
import { db } from '../config/database';
import { EstadoRevision, Rol, TipoDocumento } from '../config/constants';

export type Fila<T extends object> = Model<T, Partial<T>> & T;

function modelo<T extends object>(tabla: string, atributos: ModelAttributes<Fila<T>>): ModelStatic<Fila<T>> {
  return db.define<Fila<T>>(tabla, atributos, { underscored: true });
}

const pk = () => ({ type: D.INTEGER, primaryKey: true, autoIncrement: true });
const fk = (primaryKey = false) => ({ type: D.INTEGER, primaryKey, allowNull: false });

export interface Usuario {
  id: number;
  identificador: string;
  nombreCompleto: string;
  correo: string;
  passwordHash: string;
  rol: Rol;
  activo: boolean;
  versionSesion: number;
  fechaCreacion: Date;
}
export const Usuarios = modelo<Usuario>('usuarios', {
  id: pk(), identificador: D.STRING, nombreCompleto: D.STRING, correo: D.STRING,
  passwordHash: D.STRING, rol: D.STRING, activo: D.BOOLEAN, versionSesion: D.INTEGER, fechaCreacion: D.DATE,
});

export const Personal = modelo<{ usuarioId: number; departamento: string | null }>('personal', {
  usuarioId: fk(true), departamento: D.STRING,
});

export interface Alumno {
  usuarioId: number;
  nombre: string;
  apellidos: string;
  carrera: string | null;
  semestre: number | null;
  telefono: string | null;
  planEstudios: string | null;
  cursoInduccionAcreditado: boolean;
}
export const Alumnos = modelo<Alumno>('alumnos', {
  usuarioId: fk(true), nombre: D.STRING, apellidos: D.STRING, carrera: D.STRING, semestre: D.INTEGER,
  telefono: D.STRING, planEstudios: D.STRING, cursoInduccionAcreditado: D.BOOLEAN,
});

export const Recuperaciones = modelo<{ usuarioId: number; hash: string; venceEn: Date }>('recuperaciones', {
  usuarioId: fk(true), hash: D.CHAR(64), venceEn: D.DATE,
});

export const Cursos = modelo<{ id: number; fechaCurso: string; periodo: string; codigoQr: string; creadoPor: number }>(
  'cursos_induccion', { id: pk(), fechaCurso: D.DATEONLY, periodo: D.STRING, codigoQr: D.UUID, creadoPor: fk() },
);
export const Asistencias = modelo<{ cursoId: number; alumnoId: number }>('asistencias_induccion', {
  cursoId: fk(true), alumnoId: fk(true),
});

export interface Programa {
  id: number;
  tipo: 'INTERNO' | 'EXTERNO';
  creadoPor: number;
  nombreProyecto: string;
  area: string;
  nombreTitular: string;
  puestoTitular: string;
  nombreResponsable: string;
  puestoResponsable: string;
  actividades: string;
  telefono: string;
  correo: string;
  domicilio: string;
  periodo: string;
  objetivo: string | null;
  horario: string | null;
  cupo: number | null;
  cupoDisponible: number | null;
  activo: boolean;
  estado: EstadoRevision;
  observaciones: string | null;
  archivoPdf: Buffer | null;
  revisadoPor: number | null;
  fechaRevision: Date | null;
  fechaEnvio: Date;
}
export const Programas = modelo<Programa>('programas', {
  id: pk(), tipo: D.STRING, creadoPor: fk(), nombreProyecto: D.STRING, area: D.STRING,
  nombreTitular: D.STRING, puestoTitular: D.STRING, nombreResponsable: D.STRING, puestoResponsable: D.STRING,
  actividades: D.TEXT, telefono: D.STRING, correo: D.STRING, domicilio: D.STRING, periodo: D.STRING,
  objetivo: D.TEXT, horario: D.STRING, cupo: D.INTEGER, cupoDisponible: D.INTEGER, activo: D.BOOLEAN,
  estado: D.STRING, observaciones: D.TEXT, archivoPdf: D.BLOB, revisadoPor: D.INTEGER,
  fechaRevision: D.DATE, fechaEnvio: D.DATE,
});

export interface Expediente {
  id: number;
  alumnoId: number;
  programaId: number;
  avanceHoras: number;
  porcentajeAvance: string;
  estadoGlobal: 'INSCRITO' | 'TERMINADO';
  fechaInscripcion: Date;
}
export const Expedientes = modelo<Expediente>('expedientes', {
  id: pk(), alumnoId: fk(), programaId: fk(), avanceHoras: D.INTEGER, porcentajeAvance: D.DECIMAL(5, 2),
  estadoGlobal: D.STRING, fechaInscripcion: D.DATE,
});
export interface Documento {
  id: number;
  expedienteId: number;
  tipo: TipoDocumento;
  numeroReporte: number;
  horas: number | null;
  nombreArchivo: string;
  archivoPdf: Buffer;
  extension: string;
  tamano: number;
  vigente: boolean;
  estado: EstadoRevision;
  observaciones: string | null;
  fechaSubida: Date;
  fechaValidacion: Date | null;
  revisadoPor: number | null;
}
export const Documentos = modelo<Documento>('documentos', {
  id: pk(), expedienteId: fk(), tipo: D.STRING, numeroReporte: D.INTEGER, horas: D.INTEGER,
  nombreArchivo: D.STRING, archivoPdf: D.BLOB, extension: D.STRING, tamano: D.INTEGER, vigente: D.BOOLEAN,
  estado: D.STRING, observaciones: D.TEXT, fechaSubida: D.DATE, fechaValidacion: D.DATE, revisadoPor: D.INTEGER,
});

export const Plantillas = modelo<{ tipo: TipoDocumento; archivoPdf: Buffer; actualizadoPor: number }>('plantillas', {
  tipo: { type: D.STRING, primaryKey: true }, archivoPdf: D.BLOB, actualizadoPor: fk(),
});

export interface Constancia {
  folio: string;
  expedienteId: number;
  emitidaPor: number;
  fechaEmision: Date;
  firmado: boolean;
  archivoPdf: Buffer;
}
export const Constancias = modelo<Constancia>('constancias_terminacion', {
  folio: { type: D.UUID, primaryKey: true }, expedienteId: fk(), emitidaPor: fk(),
  fechaEmision: D.DATE, firmado: D.BOOLEAN, archivoPdf: D.BLOB,
});

Alumnos.belongsTo(Usuarios, { foreignKey: 'usuarioId', as: 'usuario' });
Expedientes.belongsTo(Alumnos, { foreignKey: 'alumnoId', as: 'alumno' });
Expedientes.belongsTo(Programas, { foreignKey: 'programaId', as: 'programa' });
Documentos.belongsTo(Expedientes, { foreignKey: 'expedienteId', as: 'expediente' });
Constancias.belongsTo(Expedientes, { foreignKey: 'expedienteId', as: 'expediente' });
Programas.belongsTo(Usuarios, { foreignKey: 'creadoPor', as: 'autor' });
