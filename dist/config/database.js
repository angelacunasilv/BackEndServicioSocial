"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.connection = void 0;
const sequelize_1 = require("sequelize");
const env_1 = require("./env");
exports.connection = {
    host: env_1.env.DB_HOST,
    port: env_1.env.DB_PORT,
    database: env_1.env.DB_NAME,
    user: env_1.env.DB_USER,
    password: env_1.env.DB_PASSWORD,
    ssl: env_1.env.DB_SSL ? { rejectUnauthorized: true } : undefined,
};
exports.db = new sequelize_1.Sequelize(exports.connection.database, exports.connection.user, exports.connection.password, {
    dialect: 'postgres',
    host: exports.connection.host,
    port: exports.connection.port,
    logging: false,
    define: { timestamps: false, freezeTableName: true },
    pool: { max: 10, min: 0, acquire: 2500, idle: 10000 },
    dialectOptions: { ssl: exports.connection.ssl, statement_timeout: 2500, connectionTimeoutMillis: 2000 },
});
