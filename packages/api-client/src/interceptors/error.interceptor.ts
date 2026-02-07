import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiConfig } from '../types';

const SERVER_UNAVAILABLE_KEY = 'velox_server_unavailable';

// Variable para evitar múltiples redirecciones simultáneas
let isRedirecting = false;

// Variable para evitar múltiples refresh simultáneos
let isRefreshing = false;
type RefreshSubscriber = {
    onSuccess: (token: string) => void;
    onError: (error: Error) => void;
};
let refreshSubscribers: RefreshSubscriber[] = [];

// Función para suscribirse a la resolución del refresh
function subscribeTokenRefresh(onSuccess: (token: string) => void, onError: (error: Error) => void) {
    refreshSubscribers.push({ onSuccess, onError });
}

// Función para notificar a todos los suscriptores
function onRefreshed(token: string) {
    refreshSubscribers.forEach((subscriber) => subscriber.onSuccess(token));
    refreshSubscribers = [];
}

function onRefreshFailed(error: Error) {
    refreshSubscribers.forEach((subscriber) => subscriber.onError(error));
    refreshSubscribers = [];
}

// Extend InternalAxiosRequestConfig to include custom retry properties
interface RequestConfigWithRetry extends InternalAxiosRequestConfig {
    _retry?: boolean;
    _apiFailoverRetryCount?: number;
}

function markServerUnavailable(reason: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SERVER_UNAVAILABLE_KEY, '1');
        window.dispatchEvent(
            new CustomEvent('api:all_endpoints_down', {
                detail: { reason, at: Date.now() },
            })
        );
    } catch {
        // ignore
    }
}

export function createErrorInterceptor(api: AxiosInstance, config: ApiConfig, failoverUrls: string[]) {
    return async (error: AxiosError & { isOffline?: boolean; isAuthError?: boolean }) => {
        // Si es un error offline, no hacer nada más (ya fue manejado en el request interceptor)
        if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED') {
            return Promise.reject(error);
        }

        const originalRequest = error.config as RequestConfigWithRetry | undefined;
        if (!originalRequest) {
            return Promise.reject(error);
        }

        // Failover logic
        const maxFailoverRetries = Math.max(0, failoverUrls.length - 1);
        const currentRetry = originalRequest._apiFailoverRetryCount ?? 0;
        const currentBaseUrl = originalRequest.baseURL || api.defaults.baseURL || '';
        const currentIndex = failoverUrls.indexOf(currentBaseUrl);
        const nextBaseUrl = currentIndex >= 0 ? failoverUrls[currentIndex + 1] : undefined;

        if (!error.response && maxFailoverRetries > 0 && currentRetry < maxFailoverRetries && nextBaseUrl) {
            // DEEP FIX: En entornos públicos (Render), no saltar agresivamente si ya estamos en el endpoint preferido.
            // 2s es insuficiente para Render bajo carga.
            const isPublicRuntime = typeof window !== 'undefined' &&
                (window.location.hostname.endsWith('.app') || window.location.hostname.includes('netlify.app'));

            // Si el error es un timeout y estamos en el endpoint público, dar más margen antes de saltar.
            const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
            const isPublicEndpoint = currentBaseUrl.includes('.onrender.com') || currentBaseUrl.includes('veloxpos.app');

            if (isPublicRuntime && isPublicEndpoint && isTimeout && currentRetry === 0) {
                // Si es el primer intento en producción y dio timeout, dar una oportunidad más con 10s
                if (config.logger) {
                    config.logger.warn(`API Timeout en Producción: Extendiendo espera a 10s antes de failover.`);
                }
                originalRequest.timeout = 10000;
                originalRequest._apiFailoverRetryCount = 0.5; // Marca especial para no entrar en loop infinito de "one more chance"
                return api(originalRequest);
            }

            if (config.logger) {
                config.logger.warn(`API Failover: ${currentBaseUrl} falló, intentando con ${nextBaseUrl} (reintento ${currentRetry + 1}/${maxFailoverRetries})`);
            }

            originalRequest._apiFailoverRetryCount = Math.floor(currentRetry) + 1;

            // Actualizar el base URL global para futuros requests
            api.defaults.baseURL = nextBaseUrl;
            originalRequest.baseURL = nextBaseUrl;

            // Timeout balanceado: 10s para producción, 2s para local (que debería ser rápido)
            // CRÍTICO: No sobreescribir si el request ya tiene un timeout superior (ej: ventas 60s)
            const nextIsPublic = nextBaseUrl.includes('.onrender.com') || nextBaseUrl.includes('veloxpos.app');
            const failoverTimeout = nextIsPublic ? 10000 : 2000;

            if (!originalRequest.timeout || originalRequest.timeout < failoverTimeout) {
                originalRequest.timeout = failoverTimeout;
            }

            return api(originalRequest);
        }

        // Online pero sin respuesta en todos los endpoints => mantenimiento/caída de backend.
        if (!error.response && typeof navigator !== 'undefined' && navigator.onLine) {
            markServerUnavailable(error.message || 'all_endpoints_unreachable');
        }

        // 401 Unauthorized - Token refresh logic
        if (error.response?.status === 401 && !originalRequest._retry) {
            error.isAuthError = true;
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');

            if (!refreshToken) {
                if (config.logger) {
                    config.logger.warn('401 pero no hay refresh_token - manteniendo sesión para operación offline');
                }
                return Promise.reject(error);
            }

            // Si ya hay un refresh en progreso, esperar a que termine
            if (isRefreshing) {
                if (config.logger) {
                    config.logger.debug('Esperando refresh en progreso');
                }
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((token: string) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        resolve(api(originalRequest));
                    }, reject);
                });
            }

            isRefreshing = true;
            if (config.logger) {
                config.logger.info('Intentando renovar token con refresh_token');
            }

            try {
                const candidateBases = Array.from(new Set(
                    [
                        originalRequest.baseURL,
                        api.defaults.baseURL,
                        ...failoverUrls,
                    ].filter((value): value is string => Boolean(value))
                ));

                let refreshResponse:
                    | { access_token: string; refresh_token: string }
                    | null = null;
                let selectedBaseUrl: string | null = null;
                let sawInfraFailure = false;
                let sawAuthFailure = false;
                let sawPublicAuthFailure = false;
                let lastRefreshError: Error | null = null;

                for (const baseUrl of candidateBases) {
                    try {
                        // Hacer el refresh sin pasar por el interceptor (para evitar bucle)
                        const response = await axios.post<{ access_token: string; refresh_token: string }>(
                            `${baseUrl}/auth/refresh`,
                            { refresh_token: refreshToken }
                        );

                        refreshResponse = response.data;
                        selectedBaseUrl = baseUrl;
                        break;
                    } catch (candidateError) {
                        const candidateAxiosError = candidateError as AxiosError;
                        const status = candidateAxiosError.response?.status;
                        const asError =
                            candidateError instanceof Error
                                ? candidateError
                                : new Error(String(candidateError));
                        lastRefreshError = asError;

                        if (status === 400 || status === 401 || status === 403) {
                            sawAuthFailure = true;
                            // Si un endpoint público falla por auth, es una señal fuerte
                            if (baseUrl.includes('.ts.net') === false && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
                                sawPublicAuthFailure = true;
                            }
                        } else {
                            sawInfraFailure = true;
                        }
                    }
                }

                if (!refreshResponse) {
                    throw Object.assign(
                        lastRefreshError ?? new Error('No se pudo renovar token en ningún endpoint'),
                        {
                            _refreshFailureKind:
                                (sawAuthFailure && !sawInfraFailure) || sawPublicAuthFailure
                                    ? 'auth'
                                    : 'infra',
                        }
                    );
                }

                const { access_token, refresh_token: newRefreshToken } = refreshResponse;

                if (config.logger) {
                    config.logger.info('Token renovado exitosamente');
                }

                if (selectedBaseUrl) {
                    api.defaults.baseURL = selectedBaseUrl;
                    originalRequest.baseURL = selectedBaseUrl;
                }

                // Actualizar tokens en localStorage
                localStorage.setItem('auth_token', access_token);
                localStorage.setItem('refresh_token', newRefreshToken);
                config.setToken(access_token);

                // Notificar a todos los requests que esperaban
                onRefreshed(access_token);

                // Actualizar el token en el request original y reintentarlo
                originalRequest.headers.Authorization = `Bearer ${access_token}`;

                isRefreshing = false;
                return api(originalRequest);
            } catch (refreshError) {
                const refreshErr =
                    refreshError instanceof Error
                        ? refreshError
                        : new Error(String(refreshError));

                if (config.logger) {
                    config.logger.error('Error al renovar token', refreshErr);
                }
                isRefreshing = false;
                onRefreshFailed(refreshErr);

                const refreshFailureKind =
                    (refreshErr as Error & { _refreshFailureKind?: 'auth' | 'infra' })
                        ._refreshFailureKind;
                const shouldForceLogout = refreshFailureKind === 'auth';

                // Solo cerrar sesión cuando el refresh fue rechazado por autenticación
                // en todos los endpoints (token realmente inválido/revocado).
                if (shouldForceLogout && !isRedirecting) {
                    isRedirecting = true;
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    config.onLogout();
                    setTimeout(() => {
                        isRedirecting = false;
                    }, 1000);
                } else if (config.logger) {
                    config.logger.warn(
                        'No se pudo renovar token por caída o error temporal del servidor; se mantiene la sesión'
                    );
                }

                return Promise.reject(error);
            }
        }

        // 403 Forbidden - License blocked
        if (error.response?.status === 403) {
            const data = error.response?.data as { code?: string; message?: string } | undefined;
            const message = typeof data?.message === 'string' ? data?.message.toLowerCase() : '';
            const isLicenseBlocked = data?.code === 'LICENSE_BLOCKED' || message.includes('licencia');

            if (isLicenseBlocked && config.logger) {
                config.logger.warn('Licencia bloqueada detectada');
            }
        }

        // Si llegamos aquí y es un 401 de un endpoint público persistente, forzar logout
        if (error.response?.status === 401) {
            const isPublic = currentBaseUrl && !currentBaseUrl.includes('.ts.net') && !currentBaseUrl.includes('localhost');
            if (isPublic && !isRedirecting) {
                isRedirecting = true;
                if (config.logger) {
                    config.logger.error('PERSISTENT 401 PUBLIC: Forzando logout nuclear.');
                }
                config.onLogout();
            }
        }

        return Promise.reject(error);
    };
}
