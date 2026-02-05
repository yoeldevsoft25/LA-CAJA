import { createApiClient, pickAvailableApi, setStoredApiBase, normalizeBaseUrl, type ApiClientConfig } from '@la-caja/api-client';
import { useAuth } from '@/stores/auth.store';
import { createLogger } from '@/lib/logger';

const logger = createLogger('API');

const PRIMARY_API_URL = normalizeBaseUrl((import.meta.env.VITE_PRIMARY_API_URL as string | undefined) ?? '');
const FALLBACK_API_URL = normalizeBaseUrl((import.meta.env.VITE_FALLBACK_API_URL as string | undefined) ?? '');
const TERTIARY_API_URL = normalizeBaseUrl((import.meta.env.VITE_TERTIARY_API_URL as string | undefined) ?? '');
const FAILOVER_API_URLS = [PRIMARY_API_URL, FALLBACK_API_URL, TERTIARY_API_URL].filter(
  (url): url is string => Boolean(url)
);

// Detectar automáticamente la URL del API basándose en la URL actual
function getApiUrl(): string {
  // 1. Si hay una variable de entorno, usarla (prioridad más alta)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 1.1 Si hay failover definido, usar el último guardado o el primero.
  // Esto aplica también en desarrollo (Tauri dev) para evitar fallback a localhost:3000.
  if (FAILOVER_API_URLS.length > 0) {
    const storedBase = localStorage.getItem('velox_api_base');
    if (
      storedBase &&
      storedBase !== window.location.origin &&
      FAILOVER_API_URLS.includes(storedBase)
    ) {
      return storedBase;
    }
    return FAILOVER_API_URLS[0];
  }

  // 2. Si estamos en localhost o preview local, usar localhost
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '4173' || // Vite preview
    window.location.port === '5173'    // Vite dev server
  ) {
    return 'http://localhost:3000';
  }

  // 3. En producción, intentar detectar automáticamente la URL del API
  if (import.meta.env.PROD) {
    const hostname = window.location.hostname;

    // Usar última URL válida si existe (para failover automático)
    const storedBase = localStorage.getItem('velox_api_base');
    if (storedBase) {
      return storedBase;
    }

    // Si estamos en Netlify (la-caja.netlify.app), usar el backend de Render
    if (hostname.includes('netlify.app')) {
      return FALLBACK_API_URL || TERTIARY_API_URL;
    }

    // Si estamos en otro dominio, intentar inferir el API URL
    // Por defecto, usar el mismo protocolo y hostname con puerto 3000
    const protocol = window.location.protocol;
    const port = protocol === 'https:' ? '' : ':3000';
    return `${protocol}//${hostname}${port}`;
  }

  // 4. En desarrollo, si estamos accediendo desde la red, usar la misma IP para el API
  const hostname = window.location.hostname;
  return `http://${hostname}:3000`;
}

const isLocalEnv = () =>
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.port === '4173' ||
  window.location.port === '5173';

const API_URL = normalizeBaseUrl(getApiUrl());

const apiConfig: ApiClientConfig = {
  baseURL: API_URL,
  timeout: 30000,
  failoverUrls: FAILOVER_API_URLS,
  isProduction: import.meta.env.PROD,
  isLocalEnv: isLocalEnv(),
  getToken: () => localStorage.getItem('auth_token'),
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
    useAuth.getState().setToken(token);
  },
  onLogout: () => {
    useAuth.getState().logout();
    setTimeout(() => {
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }, 100);
  },
  getApiUrl,
  logger: logger as ApiClientConfig['logger'],
};

export const api = createApiClient(apiConfig);

export const getApiBaseUrl = () => api.defaults.baseURL || API_URL;

// Export for backward compatibility with services that use it directly
export const ensurePrimaryPreferred = async (): Promise<void> => {
  if (!import.meta.env.PROD || isLocalEnv()) return;
  if (!PRIMARY_API_URL) return;
  if (api.defaults.baseURL === PRIMARY_API_URL) return;

  const available = await pickAvailableApi(FAILOVER_API_URLS);
  if (available && available === PRIMARY_API_URL) {
    setStoredApiBase(available);
    api.defaults.baseURL = available;
  }
};


// Probe primary API on startup
const probePrimaryApi = async (): Promise<boolean> => {
  if (!import.meta.env.PROD || isLocalEnv()) return true;
  if (FAILOVER_API_URLS.length <= 1) return true;

  const available = await pickAvailableApi(FAILOVER_API_URLS);
  if (available) {
    setStoredApiBase(available);
    api.defaults.baseURL = available;
    return available === PRIMARY_API_URL;
  }
  return false;
};

void probePrimaryApi();

// Background probing for failover
if (import.meta.env.PROD && !isLocalEnv() && FAILOVER_API_URLS.length > 1) {
  const PROBE_MIN_MS = 30 * 1000;
  const PROBE_MAX_MS = 2 * 60 * 1000;
  let probeInterval = PROBE_MIN_MS;

  const scheduleProbe = () => {
    setTimeout(async () => {
      const ok = await probePrimaryApi();
      probeInterval = ok ? PROBE_MIN_MS : Math.min(PROBE_MAX_MS, probeInterval * 2);
      scheduleProbe();
    }, probeInterval);
  };

  scheduleProbe();

  window.addEventListener('online', () => {
    void probePrimaryApi();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void probePrimaryApi();
    }
  });
}
