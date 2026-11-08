import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const formato = 'scrypt-v1';
const hashFalso = [formato, '0'.repeat(32), '0'.repeat(128)].join(':');
export const tokenAleatorio = () => randomBytes(32).toString('hex');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function derivar(contrasena: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(contrasena, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, clave) => error ? reject(error) : resolve(clave));
  });
}

export async function hashPassword(contrasena: string) {
  const salt = randomBytes(16).toString('hex');
  const clave = await derivar(contrasena, salt);
  return [formato, salt, clave.toString('hex')].join(':');
}

export async function passwordCorrecta(contrasena: string, hash = hashFalso) {
  const [version, salt, valor] = hash.split(':');
  if (version !== formato || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(valor)) return false;
  const candidata = await derivar(contrasena, salt);
  return timingSafeEqual(candidata, Buffer.from(valor, 'hex'));
}

export function tokensIguales(recibido: string, esperado: string) {
  return recibido.length === esperado.length && /^[a-f0-9]{64}$/.test(recibido)
    && timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}
