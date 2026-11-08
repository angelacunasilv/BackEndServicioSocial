"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjuntar = void 0;
const multer_1 = __importStar(require("multer"));
const errors_1 = require("./errors");
const recibir = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 14, fieldSize: 16 * 1024, parts: 16 },
}).single('archivo');
const adjuntar = (req, res, next) => {
    recibir(req, res, error => {
        if (!error || error instanceof multer_1.MulterError)
            return next(error);
        next(new errors_1.ApiError(400, 'MULTIPART_INVALIDO', 'El formulario multipart no es válido'));
    });
};
exports.adjuntar = adjuntar;
