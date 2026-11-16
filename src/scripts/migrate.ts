import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { QueryTypes } from 'sequelize';
import { db } from '../config/database';

async function migrate() {
  const directory = resolve('migrations');
  const files = (await readdir(directory)).filter(name => /^\d+_[a-zA-Z0-9_-]+\.sql$/.test(name)).sort();
  if (!files.length) throw new Error('No se encontraron migraciones SQL');
  await db.transaction(async transaction => {
    await db.query('SELECT pg_advisory_xact_lock(683103222)', { transaction });
    await db.query(
      'CREATE TABLE IF NOT EXISTS migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())',
      { transaction },
    );
    for (const filename of files) {
      const aplicada = await db.query('SELECT nombre FROM migraciones WHERE nombre = :filename', {
        replacements: { filename }, transaction, type: QueryTypes.SELECT,
      });
      if (aplicada.length) continue;
      await db.query(await readFile(resolve(directory, filename), 'utf8'), { transaction });
      await db.query('INSERT INTO migraciones(nombre) VALUES (:filename)', { replacements: { filename }, transaction });
      console.log('Migración aplicada:', filename);
    }
  });
}

migrate().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.close());
