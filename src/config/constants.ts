export const roles = ['ALU', 'JSS', 'JDV', 'ADM'] as const;
export type Rol = typeof roles[number];

export const tiposDocumento = [
  'SOLICITUD', 'CARTA_ACEPTACION', 'REPORTE_BIMESTRAL', 'REPORTE_FINAL', 'CARTA_TERMINACION',
] as const;
export type TipoDocumento = typeof tiposDocumento[number];
export type EstadoRevision = 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO';

export const entregas = [
  { tipo: 'SOLICITUD', numeroReporte: 0 },
  { tipo: 'CARTA_ACEPTACION', numeroReporte: 0 },
  { tipo: 'REPORTE_BIMESTRAL', numeroReporte: 1 },
  { tipo: 'REPORTE_BIMESTRAL', numeroReporte: 2 },
  { tipo: 'REPORTE_BIMESTRAL', numeroReporte: 3 },
  { tipo: 'REPORTE_FINAL', numeroReporte: 0 },
  { tipo: 'CARTA_TERMINACION', numeroReporte: 0 },
] as const;
export const mensajeObligatorio = 'Este campo es obligatorio';
export const mensajePdf = 'El archivo debe estar en formato PDF';
