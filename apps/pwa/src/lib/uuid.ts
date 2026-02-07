/**
 * Utility for safe UUID generation.
 * crypto.randomUUID is only available in secure contexts (HTTPS).
 * This fallback ensures the application works in local development or non-secure environments.
 */
export function randomUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // RFC4122 v4 compliant fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
