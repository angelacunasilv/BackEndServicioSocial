import { loadEnvFile } from 'node:process';
import { z } from 'zod';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const port = z.coerce.number().int().min(1).max(65535);
export const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: port.default(3000),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: port.default(5432),
  DB_SSL: z.stringbool().default(false),
  DB_NAME: z.string().min(1).default('ServicioSocial'),
  DB_USER: z.string().min(1).default('Angel'),
  DB_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  FRONTEND_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  INSTITUTIONAL_DOMAIN: z.string().trim().toLowerCase().regex(/^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)+)?$/, 'Configure un dominio sin @').default(''),
  INSTITUTION_NAME: z.string().trim().min(1).default('Tecnológico Nacional de México - Campus Culiacán'),
  SMTP_HOST: z.string().min(1).default('127.0.0.1'),
  SMTP_PORT: port.default(1025),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().min(1).default('servicio-social@localhost'),
  HOURS_REQUIRED: z.coerce.number().int().positive().default(480),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && !value.INSTITUTIONAL_DOMAIN) {
    ctx.addIssue({ code: 'custom', path: ['INSTITUTIONAL_DOMAIN'], message: 'Configure el dominio institucional' });
  }
  if (value.NODE_ENV === 'production' && !value.FRONTEND_URL.startsWith('https://')) {
    ctx.addIssue({ code: 'custom', path: ['FRONTEND_URL'], message: 'Usa HTTPS en producción' });
  }
}).parse(process.env);
