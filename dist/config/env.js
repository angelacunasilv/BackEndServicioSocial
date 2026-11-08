"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const node_process_1 = require("node:process");
const zod_1 = require("zod");
try {
    (0, node_process_1.loadEnvFile)();
}
catch (error) {
    if (error.code !== 'ENOENT')
        throw error;
}
const port = zod_1.z.coerce.number().int().min(1).max(65535);
exports.env = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: port.default(3000),
    DB_HOST: zod_1.z.string().min(1).default('127.0.0.1'),
    DB_PORT: port.default(5432),
    DB_SSL: zod_1.z.stringbool().default(false),
    DB_NAME: zod_1.z.string().min(1).default('ServicioSocial'),
    DB_USER: zod_1.z.string().min(1).default('Angel'),
    DB_PASSWORD: zod_1.z.string().min(1),
    SESSION_SECRET: zod_1.z.string().min(32),
    FRONTEND_URL: zod_1.z.url({ protocol: /^https?$/ }).default('http://localhost:5173'),
    TRUST_PROXY_HOPS: zod_1.z.coerce.number().int().min(0).default(0),
    INSTITUTIONAL_DOMAIN: zod_1.z.string().trim().toLowerCase().regex(/^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)+)?$/, 'Configure un dominio sin @').default(''),
    INSTITUTION_NAME: zod_1.z.string().trim().min(1).default('Tecnológico Nacional de México - Campus Culiacán'),
    SMTP_HOST: zod_1.z.string().min(1).default('127.0.0.1'),
    SMTP_PORT: port.default(1025),
    SMTP_SECURE: zod_1.z.stringbool().default(false),
    SMTP_USER: zod_1.z.string().default(''),
    SMTP_PASSWORD: zod_1.z.string().default(''),
    MAIL_FROM: zod_1.z.string().min(1).default('servicio-social@localhost'),
    HOURS_REQUIRED: zod_1.z.coerce.number().int().positive().default(480),
}).superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && !value.INSTITUTIONAL_DOMAIN) {
        ctx.addIssue({ code: 'custom', path: ['INSTITUTIONAL_DOMAIN'], message: 'Configure el dominio institucional' });
    }
    if (value.NODE_ENV === 'production' && !value.FRONTEND_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['FRONTEND_URL'], message: 'Usa HTTPS en producción' });
    }
}).parse(process.env);
