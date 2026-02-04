import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities/index';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { isLocalDbHost, resolveDbConnection } from './db-connection.config';

// Load .env from apps/api/ (../../.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';
const resolvedDb = resolveDbConnection((key) => process.env[key]);
const isCloudDatabase =
  resolvedDb.host.includes('supabase.co') ||
  resolvedDb.host.includes('pooler.supabase.com') ||
  resolvedDb.host.includes('render.com') ||
  resolvedDb.host.includes('aws') ||
  resolvedDb.host.includes('azure') ||
  resolvedDb.host.includes('gcp');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: resolvedDb.host,
  port: resolvedDb.port,
  username: resolvedDb.username,
  password: resolvedDb.password,
  database: resolvedDb.database,
  synchronize: false,
  logging: true,
  entities: ALL_ENTITIES,
  migrations: [path.resolve(__dirname, 'migrations/*.{ts,js}')],
  subscribers: [],
  ssl:
    isCloudDatabase && !isLocalDbHost(resolvedDb.host)
      ? { rejectUnauthorized: sslRejectUnauthorized }
      : false,
});
