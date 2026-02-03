import type { InternalAxiosRequestConfig } from 'axios';
import type { ApiConfig } from '../types';
import { decodeJWT } from '../utils/jwt';

export function createAuthInterceptor(config: ApiConfig) {
    return async (axiosConfig: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
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
