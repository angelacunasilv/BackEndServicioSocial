"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mensajePdf = exports.mensajeObligatorio = exports.entregas = exports.tiposDocumento = exports.roles = void 0;
exports.roles = ['ALU', 'JSS', 'JDV', 'ADM'];
exports.tiposDocumento = [
    'SOLICITUD', 'CARTA_ACEPTACION', 'REPORTE_BIMESTRAL', 'REPORTE_FINAL', 'CARTA_TERMINACION',
];
exports.entregas = [
    { tipo: 'SOLICITUD', numeroReporte: 0 },
    { tipo: 'CARTA_ACEPTACION', numeroReporte: 0 },
    { tipo: 'REPORTE_BIMESTRAL', numeroReporte: 1 },
    { tipo: 'REPORTE_BIMESTRAL', numeroReporte: 2 },
    { tipo: 'REPORTE_BIMESTRAL', numeroReporte: 3 },
    { tipo: 'REPORTE_FINAL', numeroReporte: 0 },
    { tipo: 'CARTA_TERMINACION', numeroReporte: 0 },
];
exports.mensajeObligatorio = 'Este campo es obligatorio';
exports.mensajePdf = 'El archivo debe estar en formato PDF';
