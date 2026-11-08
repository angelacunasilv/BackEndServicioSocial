import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { QueryTypes } from 'sequelize';
import { db } from '../config/database';

async function migrate() {
  const filename = '001_inicial.sql';
  const sql = await readFile(resolve('migrations', filename), 'utf8');
  await db.transaction(async transaction => {
    await db.query('SELECT pg_advisory_xact_lock(683103222)', { transaction });
    await db.query(
      'CREATE TABLE IF NOT EXISTS migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())',
      { transaction },
    );
    const aplicada = await db.query('SELECT nombre FROM migraciones WHERE nombre = :filename', {
      replacements: { filename }, transaction, type: QueryTypes.SELECT,
    });
    if (aplicada.length) return;
    await db.query(sql, { transaction });
    await db.query('INSERT INTO migraciones(nombre) VALUES (:filename)', { replacements: { filename }, transaction });
    console.log('Migración aplicada:', filename);
  });
}

migrate().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.close());
