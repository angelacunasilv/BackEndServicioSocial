"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errores = exports.ApiError = void 0;
exports.encontrado = encontrado;
const multer_1 = require("multer");
const sequelize_1 = require("sequelize");
const zod_1 = require("zod");
class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
exports.ApiError = ApiError;
function encontrado(value, message) {
    if (value === null)
        throw new ApiError(404, 'NO_ENCONTRADO', message);
    return value;
}
const errores = (error, _req, res, next) => {
    if (res.headersSent)
        return next(error);
    let failure;
    if (error instanceof ApiError) {
        failure = error;
    }
    else if (error instanceof zod_1.z.ZodError) {
        failure = new ApiError(400, 'VALIDACION', 'Revise los campos indicados', error.issues.map(issue => ({
            campo: issue.path.join('.'), mensaje: issue.message,
        })));
    }
    else if (error instanceof multer_1.MulterError) {
        failure = error.code === 'LIMIT_FILE_SIZE'
            ? new ApiError(413, 'ARCHIVO_GRANDE', 'El archivo supera el límite de 10 MiB')
            : new ApiError(400, 'ARCHIVO_INVALIDO', 'Envíe un archivo en el campo archivo y revise los campos del formulario');
    }
    else if (error instanceof sequelize_1.UniqueConstraintError || error instanceof sequelize_1.ForeignKeyConstraintError) {
        failure = new ApiError(409, 'CONFLICTO', 'La operación entra en conflicto con un registro existente');
    }
    else if (error instanceof URIError || error?.type === 'request.aborted' || error?.type === 'request.size.invalid') {
        failure = new ApiError(400, 'SOLICITUD_INVALIDA', 'La solicitud no es válida');
    }
    else if (error?.type === 'charset.unsupported' || error?.type === 'encoding.unsupported') {
        failure = new ApiError(415, 'CODIFICACION_INVALIDA', 'La codificación de la solicitud no está soportada');
    }
    else if (error?.type === 'entity.parse.failed') {
        failure = new ApiError(400, 'JSON_INVALIDO', 'El cuerpo JSON no es válido');
    }
    else if (error?.type === 'entity.too.large') {
        failure = new ApiError(413, 'CUERPO_GRANDE', 'El cuerpo supera el tamaño permitido');
    }
    else {
        console.error('Error de solicitud', { id: res.locals.requestId, tipo: error?.name, codigo: error?.parent?.code });
        failure = new ApiError(500, 'ERROR_INTERNO', 'No se pudo completar la operación');
    }
    res.status(failure.status).json({
        error: { codigo: failure.code, mensaje: failure.message, detalles: failure.details },
        solicitudId: res.locals.requestId,
    });
};
exports.errores = errores;
