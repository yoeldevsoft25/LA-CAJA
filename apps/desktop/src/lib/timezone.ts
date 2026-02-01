/**
 * Utilidades para manejar fechas con zona horaria configurable.
 * Usa Intl.DateTimeFormat para evitar dependencias adicionales.
 */

const DEFAULT_TIME_ZONE = 'UTC'

export const APP_TIME_ZONE = import.meta.env.VITE_APP_TIMEZONE || DEFAULT_TIME_ZONE

/**
 * Devuelve la fecha en formato YYYY-MM-DD calculada en la zona horaria configurada.
 */
export function formatDateInAppTimeZone(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date) // en-CA => YYYY-MM-DD
}

/**
 * Texto amigable de la zona horaria usada (ej: America/Caracas)
 */
export function getTimeZoneLabel(): string {
  return APP_TIME_ZONE
}
