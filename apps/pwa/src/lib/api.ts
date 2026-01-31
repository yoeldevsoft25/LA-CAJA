import axios from 'axios';
import { useAuth, type AuthUser } from '@/stores/auth.store';
import { createLogger } from '@/lib/logger';

const logger = createLogger('API');

const PRIMARY_API_URL = (import.meta.env.VITE_PRIMARY_API_URL as string | undefined) ?? '';
const FALLBACK_API_URL = (import.meta.env.VITE_FALLBACK_API_URL as string | undefined) ?? '';
const API_BASE_STORAGE_KEY = 'velox_api_base';

/**
 * Decodifica un token JWT sin verificar la firma (solo para extraer datos)
 * Los tokens JWT tienen formato: header.payload.signature
 */
function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    // Decodificar el payload (segunda parte)
    const payload = parts[1];
    // Reemplazar caracteres base64url por base64 estándar
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Agregar padding si es necesario
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    logger.error('Error decodificando JWT', error);
    return null;
  }
}

// Detectar automáticamente la URL del API basándose en la URL actual
function getApiUrl(): string {
  // 1. Si hay una variable de entorno, usarla (prioridad más alta)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 1.1 Si hay primary/fallback definidos, usar el último guardado o el primary
  if (import.meta.env.PROD && (PRIMARY_API_URL || FALLBACK_API_URL)) {
    const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY);
    if (storedBase && storedBase !== window.location.origin) {
      return storedBase;
    }
    return PRIMARY_API_URL || FALLBACK_API_URL;
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
    const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY);
    if (storedBase) {
      return storedBase;
    }

    // Si estamos en Netlify (la-caja.netlify.app), usar el backend de Render
    if (hostname.includes('netlify.app')) {
      return FALLBACK_API_URL;
    }
    
    // Si estamos en otro dominio, intentar inferir el API URL
    // Opción 1: Mismo dominio, puerto 3000 (si es local)
    // Opción 2: Dominio API (si existe un patrón conocido)
    // Por defecto, usar el mismo protocolo y hostname con puerto 3000
    const protocol = window.location.protocol;
    const port = protocol === 'https:' ? '' : ':3000';
    return `${protocol}//${hostname}${port}`;
  }

  // 4. En desarrollo, si estamos accediendo desde la red, usar la misma IP para el API
  const hostname = window.location.hostname;
  return `http://${hostname}:3000`;
}

const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Timeout de 30 segundos (aumentado para importaciones largas)
});

const setApiBaseUrl = (nextBaseUrl: string) => {
  api.defaults.baseURL = nextBaseUrl;
  localStorage.setItem(API_BASE_STORAGE_KEY, nextBaseUrl);
};

const isLocalEnv = () =>
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.port === '4173' ||
  window.location.port === '5173';

const probePrimaryApi = async () => {
  if (!import.meta.env.PROD || isLocalEnv()) return;
  if (!PRIMARY_API_URL || !FALLBACK_API_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`${PRIMARY_API_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
      mode: 'no-cors',
      headers: PRIMARY_API_URL.includes('ngrok-free.dev')
        ? { 'ngrok-skip-browser-warning': '1' }
        : undefined,
      signal: controller.signal,
    });
    // Si no falla la red, asumimos que el host primario está disponible
    setApiBaseUrl(PRIMARY_API_URL);
  } catch {
    setApiBaseUrl(FALLBACK_API_URL);
  } finally {
    clearTimeout(timeout);
  }
};

void probePrimaryApi();

if (import.meta.env.PROD && !isLocalEnv() && PRIMARY_API_URL && FALLBACK_API_URL) {
  const PROBE_INTERVAL_MS = 2 * 60 * 1000;

  setInterval(() => {
    void probePrimaryApi();
  }, PROBE_INTERVAL_MS);

  window.addEventListener('online', () => {
    void probePrimaryApi();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void probePrimaryApi();
    }
  });
}

// Interceptor para agregar token JWT y bloquear peticiones offline
api.interceptors.request.use(
  (config) => {
    // Bloquear peticiones si está offline
    if (!navigator.onLine) {
      return Promise.reject({
        code: 'ERR_INTERNET_DISCONNECTED',
        message: 'Sin conexión a internet',
        isOffline: true,
      });
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      // Decodificar token para logging de depuración
      const decoded = decodeJWT(token);
      const authState = useAuth.getState();
      
      if (decoded) {
        logger.debug('Token info', {
          url: config.url,
          roleInToken: decoded.role,
          roleInStore: authState.user?.role,
          userIdInToken: decoded.sub,
          userIdInStore: authState.user?.user_id,
        });
        
        // Si hay discrepancia, advertir
        if (decoded.role !== authState.user?.role) {
          logger.warn('DISCREPANCIA DE ROL', {
            tokenRole: decoded.role,
            storeRole: authState.user?.role,
            tokenUserId: decoded.sub,
            storeUserId: authState.user?.user_id,
          });
        }
        
        // Si hay discrepancia en user_id, advertir también
        if (decoded.sub !== authState.user?.user_id) {
          logger.warn('DISCREPANCIA DE USER_ID', {
            tokenUserId: decoded.sub,
            storeUserId: authState.user?.user_id,
            tokenRole: decoded.role,
            storeRole: authState.user?.role,
          });
        }
      }
      
      config.headers.Authorization = `Bearer ${token}`;
    }

    const baseUrl = config.baseURL || api.defaults.baseURL || '';
    if (baseUrl.includes('ngrok-free.dev')) {
      config.headers['ngrok-skip-browser-warning'] = '1';
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Variable para evitar múltiples redirecciones simultáneas
let isRedirecting = false;

// Variable para evitar múltiples refresh simultáneos
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

// Función para suscribirse a la resolución del refresh
function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

// Función para notificar a todos los suscriptores
function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Si es un error offline, no hacer nada más (ya fue manejado en el request interceptor)
    if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED') {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    if (!error.response && PRIMARY_API_URL && FALLBACK_API_URL && api.defaults.baseURL === PRIMARY_API_URL && !originalRequest?._apiFailoverRetry) {
      originalRequest._apiFailoverRetry = true;
      setApiBaseUrl(FALLBACK_API_URL);
      originalRequest.baseURL = FALLBACK_API_URL;
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // ✅ OFFLINE-FIRST: Marcar error como no-retriable para React Query
      error.isAuthError = true;

      // Marcar que ya intentamos hacer refresh para este request
      originalRequest._retry = true;

      // 🔄 REFRESH TOKEN: Intentar renovar el token automáticamente
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        logger.warn('401 pero no hay refresh_token - redirigiendo a login');
        if (!isRedirecting && !window.location.pathname.includes('/login')) {
          isRedirecting = true;
          localStorage.removeItem('auth_token');
          useAuth.getState().logout();
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        }
        return Promise.reject(error);
      }

      // Si ya hay un refresh en progreso, esperar a que termine
      if (isRefreshing) {
        logger.debug('Esperando refresh en progreso');
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      logger.info('Intentando renovar token con refresh_token');

      try {
        // Hacer el refresh sin pasar por el interceptor (para evitar bucle)
        const response = await axios.post(
          `${originalRequest.baseURL}/auth/refresh`,
          { refresh_token: refreshToken }
        );

        const { access_token, refresh_token: newRefreshToken } = response.data;
        
        // ✅ ROTACIÓN: Actualizar el refresh token en localStorage con el nuevo token
        // El backend ahora rota los refresh tokens por seguridad

        logger.info('Token renovado exitosamente');

        // Decodificar el nuevo token para extraer información del usuario
        const decoded = decodeJWT(access_token);
        if (decoded) {
          logger.debug('Token decodificado', { userId: decoded.sub, role: decoded.role, storeId: decoded.store_id });
          
          // Actualizar el estado del usuario con la información del token
          const auth = useAuth.getState();
          const currentUser = auth.user;
          
          if (currentUser) {
            // El JWT solo contiene: sub (user_id), store_id, role
            // Mantener los demás campos del usuario actual (full_name, license_status, etc.)
            const updatedUser: AuthUser = {
              user_id: decoded.sub || currentUser.user_id,
              store_id: decoded.store_id || currentUser.store_id,
              role: decoded.role || currentUser.role, // Actualizar rol del token
              full_name: currentUser.full_name, // Mantener nombre del usuario actual
              license_status: currentUser.license_status,
              license_expires_at: currentUser.license_expires_at,
              license_plan: currentUser.license_plan,
              license_features: currentUser.license_features,
            };
            
            // Si el rol cambió, loguear el cambio y mostrar advertencia
            if (updatedUser.role !== currentUser.role) {
              logger.warn('Rol del usuario cambió en el token', {
                oldRole: currentUser.role,
                newRole: updatedUser.role,
                userId: currentUser.user_id,
              });
              // Mostrar toast de advertencia al usuario
              import('@/lib/toast').then(({ default: toast }) => {
                toast.error(
                  `Tu rol ha cambiado a: ${updatedUser.role === 'owner' ? 'Propietario' : 'Cajero'}. Recarga la página.`,
                  { duration: 5000 }
                );
              });
            }
            
            // Actualizar el usuario en el store
            auth.setUser(updatedUser);
          } else {
            // Si no hay usuario actual pero tenemos token, intentar crear uno básico
            logger.warn('No hay usuario en el store pero se renovó el token');
          }
        } else {
          logger.warn('No se pudo decodificar el token, manteniendo estado actual');
        }

        // Actualizar tokens en localStorage y store
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('refresh_token', newRefreshToken);
        useAuth.getState().setToken(access_token);

        // Notificar a todos los requests que esperaban
        onRefreshed(access_token);

        // Actualizar el token en el request original y reintentarlo
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        logger.error('Error al renovar token', refreshError);
        isRefreshing = false;

        // Si falla el refresh, cerrar sesión
        if (!isRedirecting && !window.location.pathname.includes('/login')) {
          isRedirecting = true;
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          useAuth.getState().logout();
          setTimeout(() => {
            window.location.href = '/login';
          }, 100);
        }

        return Promise.reject(error);
      }
    }

    if (error.response?.status === 403) {
      const data = error.response?.data as { code?: string; message?: string } | undefined
      const message = typeof data?.message === 'string' ? data?.message.toLowerCase() : ''
      const isLicenseBlocked =
        data?.code === 'LICENSE_BLOCKED' || message.includes('licencia')

      if (isLicenseBlocked) {
        const auth = useAuth.getState()
        const currentUser = auth.user
        if (currentUser) {
          auth.setUser({
            ...currentUser,
            license_status: currentUser.license_status ?? 'suspended',
          })
        }
        window.location.href = '/license'
      }
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);
