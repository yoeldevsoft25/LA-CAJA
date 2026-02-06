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
const API_BASE_STORAGE_KEY = 'velox_api_base';
const SERVER_UNAVAILABLE_KEY = 'velox_server_unavailable';

const isLocalHostname = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1';

const isPrivateIp = (hostname: string): boolean =>
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
  /^100\./.test(hostname) || // Tailscale CGNAT range
  /^169\.254\./.test(hostname);

const isTailnetHost = (hostname: string): boolean =>
  hostname.endsWith('.ts.net');

const classifyApiUrl = (url: string): 'public' | 'tailnet' | 'private' | 'local' => {
  try {
    const hostname = new URL(url).hostname;
    if (isLocalHostname(hostname)) return 'local';
    if (isTailnetHost(hostname)) return 'tailnet';
    if (isPrivateIp(hostname)) return 'private';
    return 'public';
  } catch {
    return 'public';
  }
};

const isPublicWebRuntime = (): boolean => {
  if (!import.meta.env.PROD) return false;
  const hostname = window.location.hostname;
  if (isLocalHostname(hostname)) return false;
  if (isPrivateIp(hostname)) return false;
  if (isTailnetHost(hostname)) return false;
  return true;
};

const FORCE_PRIMARY_FIRST =
  String(import.meta.env.VITE_FORCE_PRIMARY_API_URL || '').toLowerCase() === 'true';

const ORDERED_FAILOVER_API_URLS = (() => {
  if (FAILOVER_API_URLS.length <= 1) return FAILOVER_API_URLS;
  if (!isPublicWebRuntime() || FORCE_PRIMARY_FIRST) return FAILOVER_API_URLS;

  // For public PWA (e.g. veloxpos.app), avoid starting on private/tailnet endpoints.
  const rank: Record<ReturnType<typeof classifyApiUrl>, number> = {
    public: 0,
    tailnet: 1,
    private: 2,
    local: 3,
  };

  return [...FAILOVER_API_URLS].sort((a, b) => rank[classifyApiUrl(a)] - rank[classifyApiUrl(b)]);
})();

const PREFERRED_API_URL = ORDERED_FAILOVER_API_URLS[0] || '';

// Detectar automáticamente la URL del API basándose en la URL actual
function getApiUrl(): string {
  // 1. Si hay una variable de entorno, usarla (prioridad más alta)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 1.1 Si hay failover definido, usar el último guardado o el primero
  if (import.meta.env.PROD && ORDERED_FAILOVER_API_URLS.length > 0) {
    const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY);
    const shouldIgnoreStoredBase =
      storedBase &&
      isPublicWebRuntime() &&
      classifyApiUrl(storedBase) !== 'public';

    if (shouldIgnoreStoredBase) {
      localStorage.removeItem(API_BASE_STORAGE_KEY);
    }

    if (
      storedBase &&
      storedBase !== window.location.origin &&
      ORDERED_FAILOVER_API_URLS.includes(storedBase) &&
      !shouldIgnoreStoredBase
    ) {
      return storedBase;
    }
    return ORDERED_FAILOVER_API_URLS[0];
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
  failoverUrls: ORDERED_FAILOVER_API_URLS,
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
  if (!PREFERRED_API_URL) return;
  if (api.defaults.baseURL === PREFERRED_API_URL) return;

  const available = await pickAvailableApi(ORDERED_FAILOVER_API_URLS);
  if (available && available === PREFERRED_API_URL) {
    setStoredApiBase(available);
    api.defaults.baseURL = available;
  }
};


// Probe primary API on startup
const probePrimaryApi = async (): Promise<boolean> => {
  if (!import.meta.env.PROD || isLocalEnv()) return true;
  if (ORDERED_FAILOVER_API_URLS.length <= 1) return true;

  const available = await pickAvailableApi(ORDERED_FAILOVER_API_URLS);
  if (available) {
    setStoredApiBase(available);
    api.defaults.baseURL = available;
    try {
      localStorage.removeItem(SERVER_UNAVAILABLE_KEY);
      window.dispatchEvent(new CustomEvent('api:endpoint_recovered', { detail: { at: Date.now(), baseURL: available } }));
    } catch {
      // ignore
    }
    return available === PREFERRED_API_URL;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      localStorage.setItem(SERVER_UNAVAILABLE_KEY, '1');
      window.dispatchEvent(new CustomEvent('api:all_endpoints_down', { detail: { reason: 'probe_failed', at: Date.now() } }));
    } catch {
      // ignore
    }
  }
  return false;
};

void probePrimaryApi();

// Background probing for failover
if (import.meta.env.PROD && !isLocalEnv() && ORDERED_FAILOVER_API_URLS.length > 1) {
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
