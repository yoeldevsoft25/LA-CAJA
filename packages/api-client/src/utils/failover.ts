import { getNgrokHeaders } from './ngrok';
import { normalizeBaseUrl, joinUrl } from './url';

const API_BASE_STORAGE_KEY = 'velox_api_base';
const PRIMARY_PROBE_INTERVAL_MS = 5000;
const DEFAULT_PROBE_TIMEOUT_MS = 1000;

let lastPrimaryProbeAt = 0;
let primaryProbeInFlight: Promise<boolean> | null = null;

/**
 * Probes an API endpoint to check if it's available
 * @param url - Base URL to probe (will be normalized)
 * @param timeoutMs - Timeout in milliseconds (default 1000ms)
 * @returns true if API responds successfully, false otherwise
 */
export async function probeApi(url: string, timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return false;
    }

    const normalizedUrl = normalizeBaseUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(joinUrl(normalizedUrl, '/ping'), {
            method: 'GET',
            cache: 'no-store',
            headers: getNgrokHeaders(normalizedUrl),
            signal: controller.signal,
        });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Picks the first available API from a list of URLs
 * @param urls - Array of base URLs to try (will be normalized)
 * @returns First available URL or null if none are available
 */
export async function pickAvailableApi(urls: string[]): Promise<string | null> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return null;
    }

    for (const url of urls) {
        const normalizedUrl = normalizeBaseUrl(url);
        if (await probeApi(normalizedUrl)) {
            return normalizedUrl;
        }
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
        const normalizedUrl = normalizeBaseUrl(url);
        localStorage.setItem(API_BASE_STORAGE_KEY, normalizedUrl);
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
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return currentBaseUrl;
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
