import type { AxiosInstance } from 'axios';

export type ApiClientLike = AxiosInstance;

let currentApiClient: ApiClientLike | null = null;

export const setApiClient = (client: ApiClientLike): void => {
    currentApiClient = client;
};

export const getApiClient = (): ApiClientLike => {
    if (!currentApiClient) {
        throw new Error('API client not configured. Call setApiClient() during app startup.');
    }
    return currentApiClient;
};

export const api: ApiClientLike = new Proxy({} as ApiClientLike, {
    get(_target, prop) {
        const client = getApiClient();
        const value = (client as any)[prop];
        if (typeof value === 'function') return value.bind(client);
        return value;
    },
});
