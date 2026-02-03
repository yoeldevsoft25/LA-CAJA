export function getNgrokHeaders(url: string): Record<string, string> | undefined {
    return url.includes('ngrok-free.dev') ? { 'ngrok-skip-browser-warning': '1' } : undefined;
}

export function isNgrokUrl(url: string): boolean {
    return url.includes('ngrok-free.dev');
}
