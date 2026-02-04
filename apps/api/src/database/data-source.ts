import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root (../../../../.env)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const isLocal = process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';
const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

const dbConfig = isLocal
  ? {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'la_caja',
  }
  : {
    url: process.env.DATABASE_URL,
  };

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...dbConfig,
  synchronize: false,
  logging: true,
  entities: ALL_ENTITIES,
  migrations: [path.resolve(__dirname, 'migrations/*.{ts,js}')],
  subscribers: [],
  ssl: isLocal
    ? false
    : process.env.DATABASE_URL &&
      (process.env.DATABASE_URL.includes('render') ||
        process.env.DATABASE_URL.includes('supabase'))
      ? { rejectUnauthorized: sslRejectUnauthorized }
      : false,
});
