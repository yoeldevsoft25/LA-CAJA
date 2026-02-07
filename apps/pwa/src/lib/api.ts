import {
  createApiClient,
  pickAvailableApi,
  setStoredApiBase,
  normalizeBaseUrl,
  type ApiClientConfig
} from '@la-caja/api-client';
import { useAuth } from '@/stores/auth.store';
import { createLogger } from '@/lib/logger';

// --- 1. CONFIGURACIÓN Y CONSTANTES ---
const logger = createLogger('API');

const ENV = {
  PRIMARY: normalizeBaseUrl(import.meta.env.VITE_PRIMARY_API_URL ?? ''),
  FALLBACK: normalizeBaseUrl(import.meta.env.VITE_FALLBACK_API_URL ?? ''),
  TERTIARY: normalizeBaseUrl(import.meta.env.VITE_TERTIARY_API_URL ?? ''),
  FORCE_PRIMARY: String(import.meta.env.VITE_FORCE_PRIMARY_API_URL || '').toLowerCase() === 'true',
  TIMEOUT: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30000,
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,
};

// URLs crudas disponibles
const RAW_API_URLS = [ENV.PRIMARY, ENV.FALLBACK, ENV.TERTIARY].filter(Boolean) as string[];

const STORAGE_KEYS = {
  BASE_URL: 'velox_api_base',
  SERVER_UNAVAILABLE: 'velox_server_unavailable',
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
};

// --- 2. UTILIDADES DE RED (Helpers Puros) ---

type NetworkType = 'local' | 'private' | 'tailnet' | 'public';

const NetworkUtils = {
  isLocalhost: (hostname: string) =>
    hostname === 'localhost' || hostname === '127.0.0.1',

  isPrivateIp: (hostname: string) =>
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^100\./.test(hostname) || // Tailscale / CGNAT
    /^169\.254\./.test(hostname),

  isTailnet: (hostname: string) =>
    hostname.endsWith('.ts.net'),

  classifyUrl: (urlStr: string): NetworkType => {
    try {
      const hostname = new URL(urlStr).hostname;
      if (NetworkUtils.isLocalhost(hostname)) return 'local';
      if (NetworkUtils.isTailnet(hostname)) return 'tailnet';
      if (NetworkUtils.isPrivateIp(hostname)) return 'private';
      return 'public';
    } catch {
      return 'public'; // Fallback seguro
    }
  },

  /**
   * Determina si el cliente (navegador) está corriendo en la web pública
   * o en una red local/híbrida.
   */
  isPublicWebRuntime: () => {
    const h = window.location.hostname;
    if (NetworkUtils.isLocalhost(h)) return false;
    if (NetworkUtils.isPrivateIp(h)) return false;
    if (NetworkUtils.isTailnet(h)) return false;

    // Dominios conocidos de producción pública
    return (
      h.endsWith('veloxpos.app') ||
      h.includes('netlify.app') ||
      h.endsWith('velox.pos') ||
      ENV.IS_PROD // Asumir público en build de prod por defecto si no cae en los anteriores
    );
  }
};

// --- 3. ESTRATEGIA DE PRIORIZACIÓN (Failover Logic) ---

const getPrioritizedUrls = (): string[] => {
  if (RAW_API_URLS.length <= 1) return RAW_API_URLS;

  const isPublicRuntime = NetworkUtils.isPublicWebRuntime();

  // Regla 1: Si forzamos primaria o es runtime privado/local, usamos el orden del .env
  if (ENV.FORCE_PRIMARY || !isPublicRuntime) {
    return RAW_API_URLS;
  }

  // Regla 2: Excepción Crítica - Si la PRIMARIA del .env es Local/Privada,
  // priorizarla incluso si estamos en web pública (Caso de uso: PWA accediendo a servidor local)
  const primaryType = NetworkUtils.classifyUrl(RAW_API_URLS[0]);
  if (['local', 'private', 'tailnet'].includes(primaryType)) {
    logger.info('Priorizando IP Local/Privada definida explícitamente como primaria.');
    return RAW_API_URLS;
  }

  // Regla 3: Ordenamiento inteligente para Web Pública
  // Preferir endpoints públicos sobre privados para evitar timeouts innecesarios
  const rank: Record<NetworkType, number> = {
    public: 0,
    tailnet: 1,
    private: 2,
    local: 3
  };

  return [...RAW_API_URLS].sort((a, b) => {
    return rank[NetworkUtils.classifyUrl(a)] - rank[NetworkUtils.classifyUrl(b)];
  });
};

const ORDERED_FAILOVER_URLS = getPrioritizedUrls();
const PREFERRED_API_URL = ORDERED_FAILOVER_URLS[0] || '';

// --- 4. DETECCIÓN DE API INICIAL (Core Logic) ---

function detectInitialApiUrl(): string {
  // A. Variable de entorno directa (Overrule)
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  // B. Desarrollo Local (Vite)
  if (ENV.IS_DEV && NetworkUtils.isLocalhost(window.location.hostname)) {
    return 'http://localhost:3000';
  }

  // C. Lógica de Persistencia y Failover
  if (ORDERED_FAILOVER_URLS.length > 0) {
    const storedBase = localStorage.getItem(STORAGE_KEYS.BASE_URL);
    const isPublicRuntime = NetworkUtils.isPublicWebRuntime();
    const isServerKnownDown = localStorage.getItem(STORAGE_KEYS.SERVER_UNAVAILABLE) === '1';
    const isPrimaryStored = storedBase === PREFERRED_API_URL;

    // Validación de seguridad: ¿Debemos confiar en el valor guardado?
    const isValidStored = storedBase &&
      ORDERED_FAILOVER_URLS.includes(storedBase) &&
      !(isPublicRuntime && NetworkUtils.classifyUrl(storedBase) !== 'public' && !ORDERED_FAILOVER_URLS.includes(storedBase));

    // Si el guardado NO es la primaria, solo restaurarlo si sabemos que la primaria está caída.
    // Esto evita que el cliente se quede "pegado" en Render si la IP local vuelve a estar disponible.
    if (isValidStored && (isPrimaryStored || isServerKnownDown)) {
      logger.info(`Restaurando endpoint previo: ${storedBase}`);
      return storedBase!;
    }

    // Limpieza si el guardado era inválido o no debemos usarlo aún
    if (storedBase && (!isValidStored || !isServerKnownDown)) {
      if (!isPrimaryStored) {
        logger.debug(`Ignorando endpoint secundario guardado ${storedBase} para reintento de primario.`);
      }
    }

    logger.info(`Inicializando con endpoint prioritario: ${PREFERRED_API_URL}`);
    return PREFERRED_API_URL;
  }

  // D. Fallback final (Inferencia)
  const protocol = window.location.protocol;
  const port = protocol === 'https:' ? '' : ':3000';
  return `${protocol}//${window.location.hostname}${port}`;
}

// --- 5. CONFIGURACIÓN DEL CLIENTE API ---

// Ejecutar saneamiento inicial (Self-Healing)
(() => {
  if (NetworkUtils.isPublicWebRuntime()) {
    const stored = localStorage.getItem(STORAGE_KEYS.BASE_URL);
    // Si estamos en público y tenemos guardada una IP privada que NO está en la lista blanca
    if (stored && NetworkUtils.classifyUrl(stored) !== 'public' && !RAW_API_URLS.includes(stored)) {
      logger.warn('SANEAMIENTO: Eliminando configuración de red privada residual.');
      localStorage.removeItem(STORAGE_KEYS.BASE_URL);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  }
})();

const INITIAL_API_URL = normalizeBaseUrl(detectInitialApiUrl());

const apiConfig: ApiClientConfig = {
  baseURL: INITIAL_API_URL,
  timeout: Math.max(1000, ENV.TIMEOUT),
  failoverUrls: ORDERED_FAILOVER_URLS,
  isProduction: ENV.IS_PROD,
  isLocalEnv: ENV.IS_DEV, // Simplificado

  getToken: () => localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),

  setToken: (token: string) => {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    useAuth.getState().setToken(token);
  },

  onLogout: () => {
    logger.info('🛑 LOGOUT FORZADO: Limpiando sesión y datos locales.');

    // Limpieza Síncrona
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));

    // Limpieza Asíncrona (DB)
    import('@/db/database').then(({ db }) => db.delete().catch(console.error));

    // State Reset
    useAuth.getState().logout();

    // Redirección segura
    setTimeout(() => {
      if (!window.location.pathname.includes('/login')) {
        window.location.replace('/login');
      }
    }, 50);
  },

  getApiUrl: detectInitialApiUrl, // Referencia fresca
  logger: logger as ApiClientConfig['logger'],
};

export const api = createApiClient(apiConfig);
export const getApiBaseUrl = () => api.defaults.baseURL || INITIAL_API_URL;

// --- 6. SISTEMA DE PROBING (Background Recovery) ---

/**
 * Intenta reconectar con la API preferida (Primaria) si estamos usando una secundaria.
 */
const probePrimaryApi = async (): Promise<boolean> => {
  // No sondear en desarrollo local o si no hay opciones
  if (ENV.IS_DEV || ORDERED_FAILOVER_URLS.length <= 1) return true;

  const currentUrl = api.defaults.baseURL;

  // Si ya estamos en la preferida, no hacemos nada (pero limpiamos flag de error)
  if (currentUrl === PREFERRED_API_URL) {
    localStorage.removeItem(STORAGE_KEYS.SERVER_UNAVAILABLE);
    return true;
  }

  logger.debug('Sondeando disponibilidad de APIs prioritarias...');

  // pickAvailableApi buscará la primera que responda en la lista ordenada
  const bestAvailable = await pickAvailableApi(ORDERED_FAILOVER_URLS);

  if (bestAvailable) {
    // Si encontramos una mejor que la actual
    if (bestAvailable !== currentUrl) {
      logger.info(`✅ API Recuperada/Mejorada: Cambiando a ${bestAvailable}`);
      setStoredApiBase(bestAvailable);
      api.defaults.baseURL = bestAvailable;

      localStorage.removeItem(STORAGE_KEYS.SERVER_UNAVAILABLE);

      window.dispatchEvent(new CustomEvent('api:endpoint_recovered', {
        detail: { at: Date.now(), baseURL: bestAvailable }
      }));
    }
    return bestAvailable === PREFERRED_API_URL;
  }

  // Si fallan todas
  if (navigator.onLine) {
    localStorage.setItem(STORAGE_KEYS.SERVER_UNAVAILABLE, '1');
    window.dispatchEvent(new CustomEvent('api:all_endpoints_down', {
      detail: { reason: 'probe_failed', at: Date.now() }
    }));
  }

  return false;
};

// Iniciar sistema de sondeo en producción
if (ENV.IS_PROD && ORDERED_FAILOVER_URLS.length > 1) {
  const MIN_INTERVAL = 30_000;      // 30s
  const MAX_INTERVAL = 120_000;     // 2m
  let currentInterval = MIN_INTERVAL;

  const scheduleNextProbe = () => {
    setTimeout(async () => {
      const isOptimal = await probePrimaryApi();

      // Backoff exponencial si fallamos, reset si tenemos éxito
      currentInterval = isOptimal ? MIN_INTERVAL : Math.min(MAX_INTERVAL, currentInterval * 1.5);

      scheduleNextProbe();
    }, currentInterval);
  };

  // Iniciar ciclo
  scheduleNextProbe();

  // Listeners reactivos
  window.addEventListener('online', () => void probePrimaryApi());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probePrimaryApi();
  });
}

// Exportar utilidad legacy por compatibilidad
export const ensurePrimaryPreferred = probePrimaryApi;
