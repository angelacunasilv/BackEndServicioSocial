"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const schemas_1 = require("../validation/schemas");
const usuarios_1 = require("../services/usuarios");
async function main() {
    if (!process.env.ADMIN_PASSWORD)
        throw new Error('Define ADMIN_PASSWORD para crear el administrador');
    const datos = schemas_1.usuarioNuevo.parse({
        identificador: process.env.ADMIN_ID,
        nombreCompleto: process.env.ADMIN_NAME,
        correo: process.env.ADMIN_EMAIL,
        contrasena: process.env.ADMIN_PASSWORD,
        rol: 'ADM',
    });
    const { usuario } = await (0, usuarios_1.alta)(datos);
    console.log('Administrador creado:', usuario.identificador);
}
main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => database_1.db.close());
