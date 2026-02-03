import { getNgrokHeaders } from './ngrok';

const API_BASE_STORAGE_KEY = 'velox_api_base';
const PRIMARY_PROBE_INTERVAL_MS = 5000;

let lastPrimaryProbeAt = 0;
let primaryProbeInFlight: Promise<boolean> | null = null;

export async function probeApi(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
        await fetch(`${url}/health`, {
            method: 'GET',
            cache: 'no-store',
            mode: 'no-cors',
            headers: getNgrokHeaders(url),
            signal: controller.signal,
        });
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

export async function pickAvailableApi(urls: string[]): Promise<string | null> {
    for (const url of urls) {
        if (await probeApi(url)) return url;
    }
    return null;
}

export function getStoredApiBase(): string | null {
    try {
        return localStorage.getItem(API_BASE_STORAGE_KEY);
    } catch {
        return null;
    }
}

export function setStoredApiBase(url: string): void {
    try {
        localStorage.setItem(API_BASE_STORAGE_KEY, url);
    } catch {
        // Ignore storage errors
    }
}

export async function ensurePrimaryPreferred(
    currentBaseUrl: string,
    primaryUrl: string,
    isProduction: boolean,
    isLocalEnv: boolean
): Promise<string> {
    if (!isProduction || isLocalEnv) return currentBaseUrl;
    if (!primaryUrl) return currentBaseUrl;
    if (currentBaseUrl === primaryUrl) return currentBaseUrl;

    const now = Date.now();
    if (now - lastPrimaryProbeAt < PRIMARY_PROBE_INTERVAL_MS) return currentBaseUrl;
    lastPrimaryProbeAt = now;

    if (!primaryProbeInFlight) {
        primaryProbeInFlight = probeApi(primaryUrl).finally(() => {
            primaryProbeInFlight = null;
        });
    }

    const ok = await primaryProbeInFlight;
    if (ok) {
        setStoredApiBase(primaryUrl);
        return primaryUrl;
    }
    return currentBaseUrl;
}
