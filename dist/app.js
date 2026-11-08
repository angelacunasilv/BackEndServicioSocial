"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const node_crypto_1 = require("node:crypto");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const errors_1 = require("./http/errors");
const session_1 = require("./http/session");
const delete_1 = require("./routes/delete");
const get_1 = require("./routes/get");
const post_1 = require("./routes/post");
const put_1 = require("./routes/put");
exports.app = (0, express_1.default)();
const frontend = new URL(env_1.env.FRONTEND_URL).origin;
exports.app.disable('x-powered-by');
exports.app.set('trust proxy', env_1.env.TRUST_PROXY_HOPS);
exports.app.use((0, helmet_1.default)({ strictTransportSecurity: env_1.env.NODE_ENV === 'production' ? undefined : false }));
exports.app.use((_req, res, next) => {
    const solicitudId = (0, node_crypto_1.randomUUID)();
    res.locals.requestId = solicitudId;
    res.set({ 'X-Request-Id': solicitudId, 'Cache-Control': 'no-store' });
    next();
});
exports.app.use((0, cors_1.default)({
    origin: frontend, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    exposedHeaders: ['Location', 'Content-Disposition', 'X-Request-Id'],
}));
exports.app.use((req, _res, next) => {
    const origen = req.get('Origin');
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && origen && origen !== frontend) {
        throw new errors_1.ApiError(403, 'ORIGEN_NO_AUTORIZADO', 'Origen no autorizado');
    }
    next();
});
exports.app.use(express_1.default.json({ limit: '64kb' }));
exports.app.use('/api', session_1.sesiones, get_1.getRoutes, post_1.postRoutes, put_1.putRoutes, delete_1.deleteRoutes);
exports.app.use((_req, _res, next) => next(new errors_1.ApiError(404, 'RUTA_NO_ENCONTRADA', 'No se encontró la ruta solicitada')));
exports.app.use(errors_1.errores);
