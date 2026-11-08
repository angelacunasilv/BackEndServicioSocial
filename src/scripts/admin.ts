import { db } from '../config/database';
import { usuarioNuevo } from '../validation/schemas';
import { alta } from '../services/usuarios';

async function main() {
  if (!process.env.ADMIN_PASSWORD) throw new Error('Define ADMIN_PASSWORD para crear el administrador');
  const datos = usuarioNuevo.parse({
    identificador: process.env.ADMIN_ID,
    nombreCompleto: process.env.ADMIN_NAME,
    correo: process.env.ADMIN_EMAIL,
    contrasena: process.env.ADMIN_PASSWORD,
    rol: 'ADM',
  });
  const { usuario } = await alta(datos);
  console.log('Administrador creado:', usuario.identificador);
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.close());
