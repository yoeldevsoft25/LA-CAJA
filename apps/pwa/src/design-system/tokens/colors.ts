/**
 * Design System - Color Tokens
 *
 * Centralizamos los colores del brand para uso consistente en toda la app.
 * El color principal es rgb(13, 129, 206) - el azul del logo de LA CAJA.
 */

export const colors = {
  // Brand Colors (Velox Cyberpunk/Electric Theme)
  brand: {
    primary: 'rgb(0, 212, 255)', // Cyan Electrico (#00d4ff)
    primaryHsl: '190, 100%, 50%',
    primaryLight: 'rgba(0, 212, 255, 0.1)',
    primaryMedium: 'rgba(0, 212, 255, 0.3)',
    primarySoft: 'rgba(0, 212, 255, 0.5)',
    primaryDark: 'rgb(0, 160, 200)',
  },

  // Gradients
  gradients: {
    primary: 'linear-gradient(135deg, rgb(0, 212, 255) 0%, rgb(0, 150, 255) 100%)', // Cyan -> Electric Blue
    primarySoft: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(0, 212, 255, 0.02) 100%)',
    aurora: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(147, 51, 234, 0.2) 50%, rgba(0, 212, 255, 0.1) 100%)', // Cyan + Purple
    glass: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%)', // Dark Glass
    spotlight: 'conic-gradient(from 180deg at 50% 50%, rgb(0, 212, 255) 0deg, transparent 60deg, transparent 300deg, rgb(0, 212, 255) 360deg)',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 212, 255, 0.1)',
    md: '0 4px 6px -1px rgba(0, 212, 255, 0.2), 0 2px 4px -2px rgba(0, 212, 255, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 212, 255, 0.2), 0 4px 6px -4px rgba(0, 212, 255, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 212, 255, 0.25), 0 8px 10px -6px rgba(0, 212, 255, 0.1)',
    glow: '0 0 20px rgba(0, 212, 255, 0.5)',
    glowStrong: '0 0 40px rgba(0, 212, 255, 0.8)',
  },

  // Status Colors
  status: {
    online: '#22c55e',
    offline: '#ef4444',
    syncing: '#f59e0b',
  },
} as const

export type ColorToken = typeof colors
