import type { InternalAxiosRequestConfig } from 'axios';
import type { ApiConfig } from '../types';
import { decodeJWT } from '../utils/jwt';

function isPublicRoute(url?: string): boolean {
    if (!url) return false;
    return (
        url.includes('/auth/stores/public') ||
        /\/auth\/stores\/[^/]+\/cashiers\/public(?:\?|$)/.test(url) ||
        url.includes('/public/') ||
        url.includes('/ping') ||
        url.includes('/health')
    );
}

export function createAuthInterceptor(config: ApiConfig) {
    return async (axiosConfig: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
        if (isPublicRoute(axiosConfig.url)) {
            return axiosConfig;
        }

        const token = config.getToken();
        if (token) {
            // Decodificar token para logging de depuración
            const decoded = decodeJWT(token);

            if (decoded && config.logger) {
                config.logger.debug('Token info', {
                    url: axiosConfig.url,
                    roleInToken: decoded.role,
                    userIdInToken: decoded.sub,
                });
            }

            axiosConfig.headers.Authorization = `Bearer ${token}`;
        }

        return axiosConfig;
    };
}
