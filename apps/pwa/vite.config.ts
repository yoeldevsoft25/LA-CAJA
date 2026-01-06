import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(() => ({
  plugins: [
    react(),
    // Habilitar PWA también en desarrollo para soporte offline
    VitePWA({
      registerType: 'autoUpdate',
      // Evitar minificado del SW porque Terser se estaba colgando en renderChunk
      // y bloqueaba el build (workbox+terser issue).
      minify: false,
      devOptions: {
        enabled: true, // Habilitar en desarrollo
        type: 'module', // Usar module type para desarrollo
        navigateFallback: 'index.html',
        // Deshabilitar en desarrollo porque Vite necesita el servidor
        // En producción funciona perfectamente offline
        disableDevLogs: true,
      },
      workbox: {
        // CRÍTICO: Incluir runtime de Workbox directamente en el Service Worker
        // Esto evita el error "importScripts() of new scripts after service worker installation is not allowed"
        inlineWorkboxRuntime: true,
        // CRÍTICO: Precachear index.html explícitamente y todos los assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        globIgnores: ['**/node_modules/**/*', '**/sw.js'],
        // NO agregar index.html manualmente - Workbox lo detecta automáticamente
        // Si lo agregamos manualmente, causa conflicto con la entrada automática
        // Usar modo development para evitar minificación con Terser (estaba colgando el build)
        mode: 'development',
        // Estrategia para navegación: NetworkFirst con fallback a CacheFirst para offline
        runtimeCaching: [
          {
            // Interceptar TODAS las peticiones de navegación
            urlPattern: ({ request, url }) => {
              // Capturar navegación y documentos HTML
              const isNavigation = request.mode === 'navigate';
              const isDocument = request.destination === 'document';
              const isRoot = url.pathname === '/' || url.pathname === '/index.html';
              const isHtml = url.pathname.endsWith('.html');
              
              return isNavigation || isDocument || isRoot || isHtml;
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año (cache persistente)
              },
              cacheableResponse: {
                statuses: [0, 200], // Cachear incluso errores de red (status 0 = offline)
              },
              networkTimeoutSeconds: 0.3, // Timeout muy corto (300ms) para detectar offline rápido
              // Plugin para cachear incluso cuando falla la red
              plugins: [
                {
                  cacheWillUpdate: async ({ response }) => {
                    // Cachear siempre, incluso si la respuesta es un error de red (status 0)
                    // Esto permite que el caché tenga algo que servir cuando está offline
                    return response && (response.status === 0 || response.status === 200) ? response : null;
                  },
                },
              ],
            },
          },
          {
            // CRÍTICO: Interceptar módulos de Vite en desarrollo
            urlPattern: ({ url }) => {
              // Capturar módulos de Vite (@vite/client, @react-refresh, etc.)
              const pathname = url.pathname;
              return pathname.startsWith('/@') || 
                     pathname.startsWith('/src/') ||
                     pathname.includes('@vite') ||
                     pathname.includes('@react-refresh') ||
                     pathname.includes('vite-plugin-pwa') ||
                     pathname.endsWith('.tsx') ||
                     pathname.endsWith('.ts') ||
                     pathname.endsWith('.jsx') ||
                     (pathname.endsWith('.js') && !pathname.includes('node_modules'));
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vite-modules',
              expiration: {
                maxEntries: 1000, // Más entradas para desarrollo
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
              },
              cacheableResponse: {
                statuses: [0, 200], // Cachear incluso errores de red
              },
              networkTimeoutSeconds: 1, // Timeout rápido para detectar offline
            },
          },
          {
            urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
              },
            },
          },
          {
            // Interceptar manifest.webmanifest
            urlPattern: ({ url }) => url.pathname.includes('manifest.webmanifest'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 1,
            },
          },
          {
            // CRÍTICO: Cachear respuestas de API para máximo rendimiento offline
            urlPattern: ({ url }) => {
              // Cachear todas las peticiones a la API
              return url.origin.includes('onrender.com') || url.pathname.startsWith('/api/')
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 500, // Muchas respuestas de API
                maxAgeSeconds: 60 * 60 * 24, // 1 día
              },
              cacheableResponse: {
                statuses: [0, 200], // Cachear incluso errores de red
              },
              networkTimeoutSeconds: 2, // Timeout de 2 segundos
              plugins: [
                {
                  cacheWillUpdate: async ({ response }) => {
                    // Solo cachear respuestas exitosas o errores de red
                    if (response && (response.status === 0 || response.status === 200)) {
                      return response
                    }
                    return null
                  },
                },
              ],
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        // CRÍTICO: navigateFallback para servir index.html cuando falla la navegación
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [
          /^(?!\/_).*/,              // Permitir todas las rutas excepto las que empiezan con _
        ],
        navigateFallbackDenylist: [
          /^\/_/,                    // Excluir rutas que empiezan con _
          /\/[^/?]+\.[^/]+$/,        // Excluir archivos con extensión (pero permitir rutas SPA)
          /^\/api\//,                // Excluir rutas de API
          /^\/socket\.io\//,         // Excluir WebSocket
        ],
        // No hacer cache busting para index.html
        dontCacheBustURLsMatching: /^\/index\.html$/,
        // Asegurar que el precache incluya todos los assets necesarios
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'LA CAJA',
        short_name: 'LA CAJA',
        description: 'Sistema POS Offline-First',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@la-caja/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@la-caja/sync': path.resolve(__dirname, '../../packages/sync/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Exponer en la red local
  },
}));
