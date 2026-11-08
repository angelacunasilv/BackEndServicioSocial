import { app } from './app';
import { db } from './config/database';
import { env } from './config/env';
import { store } from './http/session';

async function iniciar() {
  await db.authenticate();
  const host = env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  const server = app.listen(env.PORT, host, () => console.log('API disponible en http://' + host + ':' + env.PORT + '/api'));
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      server.close(() => {
        Promise.all([db.close(), store.close()]).catch(() => { process.exitCode = 1; });
      });
    });
  }
}
iniciar().catch(async error => {
  console.error('No se pudo iniciar la API:', error.name);
  await Promise.allSettled([db.close(), store.close()]);
  process.exitCode = 1;
});
