"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const session_1 = require("./http/session");
async function iniciar() {
    await database_1.db.authenticate();
    const host = env_1.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    const server = app_1.app.listen(env_1.env.PORT, host, () => console.log('API disponible en http://' + host + ':' + env_1.env.PORT + '/api'));
    server.requestTimeout = 30000;
    server.headersTimeout = 10000;
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.once(signal, () => {
            server.close(() => {
                Promise.all([database_1.db.close(), session_1.store.close()]).catch(() => { process.exitCode = 1; });
            });
        });
    }
}
iniciar().catch(async (error) => {
    console.error('No se pudo iniciar la API:', error.name);
    await Promise.allSettled([database_1.db.close(), session_1.store.close()]);
    process.exitCode = 1;
});
