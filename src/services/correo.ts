import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY || 're_dummy_for_dev');

export async function enviarRecuperacion(correo: string, token: string) {
  const url = new URL('/restablecer-contrasena', env.FRONTEND_URL);
  url.hash = new URLSearchParams({ token }).toString();

  if (!env.RESEND_API_KEY && env.NODE_ENV === 'development') {
    console.info(`[Correo Simulado - Recuperación] Para: ${correo}\nEnlace: ${url}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to: "angelsilvaaac@gmail.com",
    subject: 'Recuperación de contraseña de Servicio Social',
    text: 'Abre este enlace para cambiar tu contraseña. Vence en 30 minutos y se puede usar una sola vez.\n\n' + url,
  });

  if (error) {
    throw new Error(error.message);
  }
}
