import type { InternalAxiosRequestConfig } from 'axios';

export function createOfflineInterceptor() {
    return async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
        // Bloquear peticiones si está offline
        if (!navigator.onLine) {
            return Promise.reject({
                code: 'ERR_INTERNET_DISCONNECTED',
                message: 'Sin conexión a internet',
                isOffline: true,
            });
        }

        return config;
    };
}
