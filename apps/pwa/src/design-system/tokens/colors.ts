/**
 * Design System - Color Tokens
 *
 * Centralizamos los colores del brand para uso consistente en toda la app.
 * El color principal es rgb(13, 129, 206) - el azul de Velox POS.
 */

export const colors = {
  // Brand Colors
  brand: {
    primary: 'hsl(var(--primary))',
    primaryHsl: '204, 89%, 43%',
    primaryLight: 'hsl(var(--primary) / 0.1)',
    primaryMedium: 'hsl(var(--primary) / 0.3)',
    primarySoft: 'hsl(var(--primary) / 0.5)',
    primaryDark: 'hsl(204 89% 35%)',
  },

  // Gradients
  gradients: {
    primary: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(204 89% 35%) 100%)',
    primarySoft: 'linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--primary) / 0.05) 100%)',
    aurora: 'linear-gradient(135deg, hsl(var(--primary) / 0.3) 0%, hsl(217 91% 60% / 0.2) 50%, hsl(var(--primary) / 0.1) 100%)',
    glass: 'linear-gradient(135deg, hsl(0 0% 100% / 0.9) 0%, hsl(0 0% 100% / 0.7) 100%)',
    spotlight: 'conic-gradient(from 180deg at 50% 50%, hsl(var(--primary)) 0deg, transparent 60deg, transparent 300deg, hsl(var(--primary)) 360deg)',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 hsl(var(--primary) / 0.05)',
    md: '0 4px 6px -1px hsl(var(--primary) / 0.1), 0 2px 4px -2px hsl(var(--primary) / 0.1)',
    lg: '0 10px 15px -3px hsl(var(--primary) / 0.1), 0 4px 6px -4px hsl(var(--primary) / 0.1)',
    xl: '0 20px 25px -5px hsl(var(--primary) / 0.15), 0 8px 10px -6px hsl(var(--primary) / 0.1)',
    glow: '0 0 20px hsl(var(--primary) / 0.4)',
    glowStrong: '0 0 40px hsl(var(--primary) / 0.6)',
  },

  // Status Colors
  status: {
    online: 'hsl(142 71% 45%)',
    offline: 'hsl(0 84% 60%)',
    syncing: 'hsl(38 92% 50%)',
  },
} as const

export type ColorToken = typeof colors
