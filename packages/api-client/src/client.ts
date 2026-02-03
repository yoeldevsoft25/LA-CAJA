import axios, { AxiosHeaders, type AxiosInstance } from 'axios';
import type { ApiConfig } from './types';
import { createAuthInterceptor } from './interceptors/auth.interceptor';
import { createOfflineInterceptor } from './interceptors/offline.interceptor';
import { createErrorInterceptor } from './interceptors/error.interceptor';
import { ensurePrimaryPreferred } from './utils/failover';
import { isNgrokUrl } from './utils/ngrok';

export interface ApiClientConfig extends ApiConfig {
    baseURL: string;
    timeout?: number;
    failoverUrls?: string[];
    isProduction?: boolean;
    isLocalEnv?: boolean;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
    const {
        baseURL,
        timeout = 30000,
        failoverUrls = [],
        isProduction = false,
        isLocalEnv = false,
    } = config;

    const api = axios.create({
        baseURL,
        headers: {
            'Content-Type': 'application/json',
        },
        timeout,
    });

    // Request interceptors
    api.interceptors.request.use(
        createOfflineInterceptor(),
        (error) => Promise.reject(error)
    );

    api.interceptors.request.use(
        async (axiosConfig) => {
            // Ensure primary API is preferred
            if (failoverUrls.length > 0) {
                const preferredUrl = await ensurePrimaryPreferred(
                    axiosConfig.baseURL || api.defaults.baseURL || baseURL,
                    failoverUrls[0],
                    isProduction,
                    isLocalEnv
                );
                axiosConfig.baseURL = preferredUrl;
                api.defaults.baseURL = preferredUrl;
            }

            // Add ngrok headers if needed
            const currentBaseUrl = axiosConfig.baseURL || api.defaults.baseURL || '';
            if (isNgrokUrl(currentBaseUrl)) {
                const headers =
                    axiosConfig.headers instanceof AxiosHeaders
                        ? axiosConfig.headers
                        : AxiosHeaders.from(axiosConfig.headers);
                headers.set('ngrok-skip-browser-warning', '1');
                axiosConfig.headers = headers;
            }

            return axiosConfig;
        },
        (error) => Promise.reject(error)
    );

    api.interceptors.request.use(
        createAuthInterceptor(config),
        (error) => Promise.reject(error)
    );

    // Response interceptor
    api.interceptors.response.use(
        (response) => response,
        createErrorInterceptor(api, config, failoverUrls)
    );

    return api;
}

export function getApiBaseUrl(api: AxiosInstance, fallback: string): string {
    return api.defaults.baseURL || fallback;
}
