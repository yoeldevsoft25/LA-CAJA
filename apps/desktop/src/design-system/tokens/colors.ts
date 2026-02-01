/**
 * Design System - Color Tokens
 *
 * Centralizamos los colores del brand para uso consistente en toda la app.
 * El color principal es rgb(13, 129, 206) - el azul del logo de LA CAJA.
 */

export const colors = {
  // Brand Colors
  brand: {
    primary: 'rgb(13, 129, 206)',
    primaryHsl: '202, 88%, 43%',
    primaryLight: 'rgba(13, 129, 206, 0.1)',
    primaryMedium: 'rgba(13, 129, 206, 0.3)',
    primarySoft: 'rgba(13, 129, 206, 0.5)',
    primaryDark: 'rgb(10, 103, 165)',
  },

  // Gradients
  gradients: {
    primary: 'linear-gradient(135deg, rgb(13, 129, 206) 0%, rgb(10, 103, 165) 100%)',
    primarySoft: 'linear-gradient(135deg, rgba(13, 129, 206, 0.1) 0%, rgba(13, 129, 206, 0.05) 100%)',
    aurora: 'linear-gradient(135deg, rgba(13, 129, 206, 0.3) 0%, rgba(59, 130, 246, 0.2) 50%, rgba(13, 129, 206, 0.1) 100%)',
    glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)',
    spotlight: 'conic-gradient(from 180deg at 50% 50%, rgb(13, 129, 206) 0deg, transparent 60deg, transparent 300deg, rgb(13, 129, 206) 360deg)',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(13, 129, 206, 0.05)',
    md: '0 4px 6px -1px rgba(13, 129, 206, 0.1), 0 2px 4px -2px rgba(13, 129, 206, 0.1)',
    lg: '0 10px 15px -3px rgba(13, 129, 206, 0.1), 0 4px 6px -4px rgba(13, 129, 206, 0.1)',
    xl: '0 20px 25px -5px rgba(13, 129, 206, 0.15), 0 8px 10px -6px rgba(13, 129, 206, 0.1)',
    glow: '0 0 20px rgba(13, 129, 206, 0.4)',
    glowStrong: '0 0 40px rgba(13, 129, 206, 0.6)',
  },

  // Status Colors
  status: {
    online: '#22c55e',
    offline: '#ef4444',
    syncing: '#f59e0b',
  },
} as const

export type ColorToken = typeof colors
