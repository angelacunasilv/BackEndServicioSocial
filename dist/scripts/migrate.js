"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
async function migrate() {
    const filename = '001_inicial.sql';
    const sql = await (0, promises_1.readFile)((0, node_path_1.resolve)('migrations', filename), 'utf8');
    await database_1.db.transaction(async (transaction) => {
        await database_1.db.query('SELECT pg_advisory_xact_lock(683103222)', { transaction });
        await database_1.db.query('CREATE TABLE IF NOT EXISTS migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())', { transaction });
        const aplicada = await database_1.db.query('SELECT nombre FROM migraciones WHERE nombre = :filename', {
            replacements: { filename }, transaction, type: sequelize_1.QueryTypes.SELECT,
        });
        if (aplicada.length)
            return;
        await database_1.db.query(sql, { transaction });
        await database_1.db.query('INSERT INTO migraciones(nombre) VALUES (:filename)', { replacements: { filename }, transaction });
        console.log('Migración aplicada:', filename);
    });
}
migrate().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => database_1.db.close());
