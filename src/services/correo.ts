import nodemailer from 'nodemailer';
import { env } from '../config/env';

const smtp = nodemailer.createTransport({
  host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  requireTLS: env.NODE_ENV === 'production' && !env.SMTP_SECURE,
  connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
});

export async function enviarRecuperacion(correo: string, token: string) {
  const url = new URL('/restablecer-contrasena', env.FRONTEND_URL);
  url.hash = new URLSearchParams({ token }).toString();
  await smtp.sendMail({
    from: env.MAIL_FROM, to: correo, subject: 'Recuperación de contraseña de Servicio Social',
    text: 'Abre este enlace para cambiar tu contraseña. Vence en 30 minutos y se puede usar una sola vez.\n\n' + url,
  });
}
