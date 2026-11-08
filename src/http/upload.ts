import { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { ApiError } from './errors';

const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 14, fieldSize: 16 * 1024, parts: 16 },
}).single('archivo');

export const adjuntar: RequestHandler = (req, res, next) => {
  recibir(req, res, error => {
    if (!error || error instanceof MulterError) return next(error);
    next(new ApiError(400, 'MULTIPART_INVALIDO', 'El formulario multipart no es válido'));
  });
};
