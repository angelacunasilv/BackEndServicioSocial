"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = exports.tokenAleatorio = void 0;
exports.hashPassword = hashPassword;
exports.passwordCorrecta = passwordCorrecta;
exports.tokensIguales = tokensIguales;
const node_crypto_1 = require("node:crypto");
const formato = 'scrypt-v1';
const hashFalso = [formato, '0'.repeat(32), '0'.repeat(128)].join(':');
const tokenAleatorio = () => (0, node_crypto_1.randomBytes)(32).toString('hex');
exports.tokenAleatorio = tokenAleatorio;
const hashToken = (token) => (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
exports.hashToken = hashToken;
function derivar(contrasena, salt) {
    return new Promise((resolve, reject) => {
        (0, node_crypto_1.scrypt)(contrasena, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, clave) => error ? reject(error) : resolve(clave));
    });
}
async function hashPassword(contrasena) {
    const salt = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const clave = await derivar(contrasena, salt);
    return [formato, salt, clave.toString('hex')].join(':');
}
async function passwordCorrecta(contrasena, hash = hashFalso) {
    const [version, salt, valor] = hash.split(':');
    if (version !== formato || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(valor))
        return false;
    const candidata = await derivar(contrasena, salt);
    return (0, node_crypto_1.timingSafeEqual)(candidata, Buffer.from(valor, 'hex'));
}
function tokensIguales(recibido, esperado) {
    return recibido.length === esperado.length && /^[a-f0-9]{64}$/.test(recibido)
        && (0, node_crypto_1.timingSafeEqual)(Buffer.from(recibido), Buffer.from(esperado));
}
