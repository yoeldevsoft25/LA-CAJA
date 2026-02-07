export type NetworkType = 'local' | 'private' | 'tailnet' | 'public';

export const NetworkUtils = {
    isLocalhost: (hostname: string) =>
        hostname === 'localhost' || hostname === '127.0.0.1',

    isPrivateIp: (hostname: string) =>
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
        /^100\./.test(hostname) || // Tailscale / CGNAT
        /^169\.254\./.test(hostname),

    isTailnet: (hostname: string) =>
        hostname.endsWith('.ts.net'),

    classifyUrl: (urlStr: string): NetworkType => {
        try {
            const hostname = new URL(urlStr).hostname;
            if (NetworkUtils.isLocalhost(hostname)) return 'local';
            if (NetworkUtils.isTailnet(hostname)) return 'tailnet';
            if (NetworkUtils.isPrivateIp(hostname)) return 'private';
            return 'public';
        } catch {
            return 'public'; // Fallback seguro
        }
    },

    /**
     * Determina si el cliente (navegador) está corriendo en la web pública
     * o en una red local/híbrida.
     */
    isPublicWebRuntime: (isProd: boolean = false) => {
        if (typeof window === 'undefined') return true; // SSR safe
        const h = window.location.hostname;
        if (NetworkUtils.isLocalhost(h)) return false;
        if (NetworkUtils.isPrivateIp(h)) return false;
        if (NetworkUtils.isTailnet(h)) return false;

        // Dominios conocidos de producción pública
        return (
            h.endsWith('veloxpos.app') ||
            h.includes('netlify.app') ||
            h.endsWith('velox.pos') ||
            isProd // Asumir público en build de prod por defecto si no cae en los anteriores
        );
    }
};
