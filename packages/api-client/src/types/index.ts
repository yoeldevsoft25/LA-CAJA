export interface ApiConfig {
    getToken: () => string | null;
    setToken: (token: string) => void;
    onLogout: () => void;
    getApiUrl: () => string;
    logger?: {
        debug: (message: string, ...args: unknown[]) => void;
        info: (message: string, ...args: unknown[]) => void;
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };
}

export interface ApiError {
    code?: string;
    message: string;
    isOffline?: boolean;
    isAuthError?: boolean;
    response?: {
        status: number;
        data: unknown;
    };
}

export interface JWTPayload {
    sub: string;
    role: string;
    store_id: string;
    exp: number;
    iat: number;
}
