import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiConfig } from '../types';
import { decodeJWT } from '../utils/jwt';

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

// Extend InternalAxiosRequestConfig to include custom retry properties
interface RequestConfigWithRetry extends InternalAxiosRequestConfig {
    _retry?: boolean;
    _apiFailoverRetryCount?: number;
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
            originalRequest._apiFailoverRetryCount = currentRetry + 1;
            api.defaults.baseURL = nextBaseUrl;
            originalRequest.baseURL = nextBaseUrl;
            return api(originalRequest);
        }

        // 401 Unauthorized - Token refresh logic
        if (error.response?.status === 401 && !originalRequest._retry) {
            error.isAuthError = true;
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');

            if (!refreshToken) {
                if (config.logger) {
                    config.logger.warn('401 pero no hay refresh_token - ejecutando logout');
                }
                if (!isRedirecting) {
                    isRedirecting = true;
                    localStorage.removeItem('auth_token');
                    config.onLogout();
                    setTimeout(() => {
                        isRedirecting = false;
                    }, 1000);
                }
                return Promise.reject(error);
            }

            // Si ya hay un refresh en progreso, esperar a que termine
            if (isRefreshing) {
                if (config.logger) {
                    config.logger.debug('Esperando refresh en progreso');
                }
                return new Promise((resolve) => {
                    subscribeTokenRefresh((token: string) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            isRefreshing = true;
            if (config.logger) {
                config.logger.info('Intentando renovar token con refresh_token');
            }

            try {
                // Hacer el refresh sin pasar por el interceptor (para evitar bucle)
                const response = await axios.post(
                    `${originalRequest.baseURL}/auth/refresh`,
                    { refresh_token: refreshToken }
                );

                const { access_token, refresh_token: newRefreshToken } = response.data;

                if (config.logger) {
                    config.logger.info('Token renovado exitosamente');
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
                if (config.logger) {
                    config.logger.error('Error al renovar token', refreshError);
                }
                isRefreshing = false;

                // Si falla el refresh, cerrar sesión
                if (!isRedirecting) {
                    isRedirecting = true;
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    config.onLogout();
                    setTimeout(() => {
                        isRedirecting = false;
                    }, 1000);
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

        return Promise.reject(error);
    };
}
