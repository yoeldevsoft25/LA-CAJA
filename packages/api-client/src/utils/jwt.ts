import type { JWTPayload } from '../types';

/**
 * Decodifica un token JWT sin verificar la firma (solo para extraer datos)
 * Los tokens JWT tienen formato: header.payload.signature
 */
export function decodeJWT(token: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        // Decodificar el payload (segunda parte)
        const payload = parts[1];
        // Reemplazar caracteres base64url por base64 estándar
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        // Agregar padding si es necesario
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const decoded = atob(padded);
        return JSON.parse(decoded) as JWTPayload;
    } catch (error) {
        console.error('Error decodificando JWT', error);
        return null;
    }
}
