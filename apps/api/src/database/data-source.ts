import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from apps/api/
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: true,
  entities: ALL_ENTITIES,
  migrations: [path.resolve(__dirname, 'migrations/*.{ts,js}')],
  subscribers: [],
  ssl:
    process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.includes('render') ||
      process.env.DATABASE_URL.includes('supabase'))
      ? { rejectUnauthorized: sslRejectUnauthorized }
      : false,
});
