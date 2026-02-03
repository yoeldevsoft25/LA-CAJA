/**
 * URL Normalization Utilities
 * Ensures consistent URL formatting across the application
 */

/**
 * Normalizes a base URL by trimming whitespace and removing trailing slashes
 * @param url - The URL to normalize
 * @returns Normalized URL without trailing slash
 */
export function normalizeBaseUrl(url: string): string {
    if (!url) return '';

    // Trim whitespace
    let normalized = url.trim();

    // Remove trailing slashes
    while (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
}

/**
 * Safely joins a base URL with a path, ensuring no double slashes
 * @param baseUrl - The base URL (will be normalized)
 * @param path - The path to append (should start with /)
 * @returns Complete URL
 */
export function joinUrl(baseUrl: string, path: string): string {
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${normalizedBase}${normalizedPath}`;
}

/**
 * Validates if a string is a valid URL
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}
