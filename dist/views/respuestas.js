"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vistaUsuario = vistaUsuario;
exports.vistaPrograma = vistaPrograma;
exports.vistaDocumento = vistaDocumento;
exports.lista = lista;
exports.enviarPdf = enviarPdf;
function vistaUsuario(usuario) {
    const { id, identificador, nombreCompleto, correo, rol, activo, fechaCreacion } = usuario;
    return { id, identificador, nombreCompleto, correo, rol, activo, fechaCreacion };
}
function vistaPrograma(programa) {
    const { archivoPdf, ...datos } = programa;
    return { ...datos, adjunto: archivoPdf !== undefined ? Boolean(archivoPdf) : undefined };
}
function vistaDocumento(documento) {
    const { archivoPdf: _archivoPdf, ...datos } = documento;
    return { ...datos, numeroReporte: datos.numeroReporte || null };
}
function lista(filas, pagina, limite) {
    return { datos: filas.rows, paginacion: { pagina, limite, total: filas.count } };
}
function enviarPdf(res, contenido, nombre, descargar = true) {
    const modo = descargar ? 'attachment' : 'inline';
    // Los nombres los construye el servidor con identificadores validados.
    res.type('application/pdf').set('Content-Disposition', modo + '; filename="' + nombre + '"').send(contenido);
}
