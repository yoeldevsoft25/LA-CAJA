const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

type GetEnvValue = (key: string) => string | undefined;

export interface ResolvedDbConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  source: 'database_url' | 'env_fields';
}

function safeDecode(value: string): string {
  if (!value) {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value || '5432', 10);
  return Number.isFinite(parsed) ? parsed : 5432;
}

function normalizeDatabase(pathname: string | undefined): string {
  if (!pathname) {
    return '';
  }

  return pathname.startsWith('/') ? pathname.slice(1) : pathname;
}

function parseUrlOrThrow(databaseUrl: string): URL {
  try {
    return new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL no tiene un formato valido');
  }
}

export function isLocalDbHost(host: string): boolean {
  return LOCAL_DB_HOSTS.has(host);
}

export function resolveDbConnection(getEnv: GetEnvValue): ResolvedDbConnection {
  const databaseUrl = getEnv('DATABASE_URL');
  const dbHost = getEnv('DB_HOST');
  const dbPort = getEnv('DB_PORT');
  const dbUser = getEnv('DB_USER');
  const dbPassword = getEnv('DB_PASSWORD');
  const dbName = getEnv('DB_NAME');
  const hasFieldConfig = Boolean(
    dbHost || dbPort || dbUser || dbPassword || dbName,
  );
  const forceFieldConfig = getEnv('DB_USE_INDIVIDUAL_CONFIG') === 'true';

  if (!databaseUrl && !hasFieldConfig) {
    throw new Error(
      'Configura DATABASE_URL o define DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME',
    );
  }

  const parsedUrl = databaseUrl ? parseUrlOrThrow(databaseUrl) : undefined;
  // Prefer DATABASE_URL whenever available to avoid accidental process-level
  // env overrides (common on Windows sessions). Use field config only when:
  // 1) explicitly forced, or 2) DATABASE_URL is not defined.
  const useFieldConfig = forceFieldConfig || (!databaseUrl && hasFieldConfig);

  const host =
    (useFieldConfig ? dbHost : undefined) || parsedUrl?.hostname || 'localhost';
  const port = parsePort(
    (useFieldConfig ? dbPort : undefined) || parsedUrl?.port,
  );
  const username =
    (useFieldConfig ? dbUser : undefined) || parsedUrl?.username || 'postgres';
  const passwordFromUrl = safeDecode(parsedUrl?.password ?? '');
  const password = (useFieldConfig ? dbPassword : undefined) ?? passwordFromUrl;
  const database =
    (useFieldConfig ? dbName : undefined) ||
    normalizeDatabase(parsedUrl?.pathname) ||
    'la_caja';

  if (!username) {
    throw new Error('DB_USER no puede estar vacio');
  }

  if (!database) {
    throw new Error('DB_NAME no puede estar vacio');
  }

  return {
    host,
    port,
    username,
    password,
    database,
    source: useFieldConfig ? 'env_fields' : 'database_url',
  };
}
