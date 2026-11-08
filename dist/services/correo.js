"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarRecuperacion = enviarRecuperacion;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const smtp = nodemailer_1.default.createTransport({
    host: env_1.env.SMTP_HOST, port: env_1.env.SMTP_PORT, secure: env_1.env.SMTP_SECURE,
    auth: env_1.env.SMTP_USER ? { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASSWORD } : undefined,
    requireTLS: env_1.env.NODE_ENV === 'production' && !env_1.env.SMTP_SECURE,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
});
async function enviarRecuperacion(correo, token) {
    const url = new URL('/restablecer-contrasena', env_1.env.FRONTEND_URL);
    url.hash = new URLSearchParams({ token }).toString();
    await smtp.sendMail({
        from: env_1.env.MAIL_FROM, to: correo, subject: 'Recuperación de contraseña de Servicio Social',
        text: 'Abre este enlace para cambiar tu contraseña. Vence en 30 minutos y se puede usar una sola vez.\n\n' + url,
    });
}
