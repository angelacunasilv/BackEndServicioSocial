import { Sequelize } from 'sequelize';
import { env } from './env';

export const connection = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: env.DB_SSL ? { rejectUnauthorized: true } : undefined,
};

export const db = new Sequelize(connection.database, connection.user, connection.password, {
  dialect: 'postgres',
  host: connection.host,
  port: connection.port,
  logging: false,
  define: { timestamps: false, freezeTableName: true },
  pool: { max: 10, min: 0, acquire: 2500, idle: 10000 },
  dialectOptions: { ssl: connection.ssl, statement_timeout: 2500, connectionTimeoutMillis: 2000 },
});
