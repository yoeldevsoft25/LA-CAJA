import { Request } from 'express';

/**
 * Obtiene una IP cliente valida para columnas PostgreSQL tipo INET.
 * Si x-forwarded-for trae una cadena con multiples IPs, toma la primera.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const headerValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.split(',')[0].trim();
  }

  if (typeof req.ip === 'string' && req.ip.trim().length > 0) {
    return req.ip;
  }

  return 'unknown';
}
