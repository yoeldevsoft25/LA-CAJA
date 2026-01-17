import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const buildId = process.env.PWA_BUILD_ID || new Date().toISOString();
const buildIdJson = JSON.stringify(buildId);
// Cache por build - se limpia automáticamente en cada build
const reactChunkCache = new Map<string, boolean>();
const nodeModulesRegex = /[\\/](node_modules)[\\/]/;
const reactDepRegex = /[\\/](node_modules)[\\/](react|react-dom|scheduler|react-is|use-sync-external-store)[\\/]/;

// Lista explícita de librerías que DEBEN estar en react-vendor (en orden de dependencias)
// CRÍTICO: goober debe ir antes que react-hot-toast para evitar errores de inicialización
const reactVendorExplicitList = [
  'goober', // DEBE ir primero - es dependencia de react-hot-toast
  'react-hot-toast',
  'recharts',
  '@radix-ui',
  '@tanstack',
  'react-router',
  'react-hook-form',
  'react-day-picker',
  'react-helmet-async',
  'framer-motion',
  '@hookform/resolvers',
  'lucide-react',
  'dexie-react-hooks',
];

const isReactChunkModule = (
  id: string,
  getModuleInfo: (id: string) => {
    importedIds?: readonly string[];
    dynamicallyImportedIds?: readonly string[];
  } | null,
  stack: Set<string>,
  depth: number = 0,
): boolean => {
  // Límite de recursión para evitar loops infinitos (máximo 10 niveles)
  if (depth > 10) {
    return false;
  }

  // Solo procesar node_modules
  if (!nodeModulesRegex.test(id)) {
    return false;
  }

  // Verificar cache
  if (reactChunkCache.has(id)) {
    return reactChunkCache.get(id) as boolean;
  }

  // Verificar si es React core directamente
  if (reactDepRegex.test(id)) {
    reactChunkCache.set(id, true);
    return true;
  }

  // Detectar ciclos
  if (stack.has(id)) {
    return false;
  }

  const info = getModuleInfo(id);
  if (!info) {
    reactChunkCache.set(id, false);
    return false;
  }

  // Agregar al stack para detectar ciclos
  stack.add(id);

  // SOLO analizar dependencias HACIA ADELANTE (no importers)
  // Analizar importers crea dependencias circulares dentro del mismo chunk
  const deps = [
    ...(info.importedIds || []),
    ...(info.dynamicallyImportedIds || []),
  ];

  // Verificar si alguna dependencia es React
  const result = deps.some((dep) => 
    isReactChunkModule(dep, getModuleInfo, stack, depth + 1)
  );

  stack.delete(id);
  reactChunkCache.set(id, result);
  return result;
};

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'emit-version',
      apply: 'build',
      transformIndexHtml(html) {
        const metaTag = `<meta name="pwa-build-id" content=${buildIdJson} />`;
        const guardScript = `
  <script>
    (function () {
      var buildId = ${buildIdJson};
      var inFlight = false;

      function clearServiceWorkerCaches() {
        var unregisterPromise = Promise.resolve();
        if ('serviceWorker' in navigator) {
          unregisterPromise = navigator.serviceWorker.getRegistrations()
            .then(function (registrations) {
              return Promise.all(registrations.map(function (registration) {
                return registration.unregister();
              }));
            });
        }

        return unregisterPromise.then(function () {
          if (!('caches' in window)) return;
          return caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
              return caches.delete(key);
            }));
          });
        });
      }

      function checkBuildMismatch() {
        if (inFlight || !navigator.onLine) return;
        inFlight = true;

        fetch('/version.json', { cache: 'no-store' })
          .then(function (response) {
            if (!response.ok) return null;
            return response.json().catch(function () {
              return null;
            });
          })
          .then(function (data) {
            if (!data || typeof data.buildId !== 'string') return;
            if (data.buildId === buildId) return;
            return clearServiceWorkerCaches().then(function () {
              window.location.reload();
            });
          })
          .catch(function () {})
          .finally(function () {
            inFlight = false;
          });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkBuildMismatch);
      } else {
        checkBuildMismatch();
      }
    })();
  </script>
`;

        if (html.includes('pwa-build-id')) return html;
        return html.replace('</head>', `  ${metaTag}${guardScript}\n</head>`);
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId }),
        });
      },
    },
    react(),
    // Habilitar PWA también en desarrollo para soporte offline
    VitePWA({
      registerType: 'autoUpdate',
      // Evitar minificado del SW porque Terser se estaba colgando en renderChunk
      // y bloqueaba el build (workbox+terser issue).
      minify: false,
      devOptions: {
        enabled: mode === 'production', // Desactivar en desarrollo para evitar cache/HMR issues
        type: 'module', // Usar module type para desarrollo
        navigateFallback: 'index.html',
        // Deshabilitar en desarrollo porque Vite necesita el servidor
        // En producción funciona perfectamente offline
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
                maxEntries: 10,
                maxAgeSeconds: 60 * 60, // 1 hora
              },
              cacheableResponse: {
                statuses: [200], // Evitar cachear respuestas offline o parciales
              },
              networkTimeoutSeconds: 3, // Dar tiempo real a la red antes de usar cache
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
            // CRÍTICO: Assets estáticos (JS, CSS, imágenes) que NO están en /assets/
            // Los archivos en /assets/ están en el precache de Workbox y se manejan automáticamente
            // Solo cachear archivos fuera de /assets/ (como favicon, etc.)
            urlPattern: ({ url }) => {
              // Excluir /assets/ porque están en el precache de Workbox
              return /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$/i.test(url.pathname) &&
                     !url.pathname.startsWith('/assets/');
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 50, // Menos entradas porque excluimos /assets/
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 días
              },
              cacheableResponse: {
                statuses: [200],
              },
              networkTimeoutSeconds: 3,
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
          /\.(js|css|json|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|webp)$/i, // Excluir todos los archivos estáticos con extensión
          /^\/assets\//,             // Excluir toda la carpeta /assets/ (archivos JS/CSS/imágenes)
          /^\/sw\.js$/,              // Excluir Service Worker
          /^\/manifest\.webmanifest$/, // Excluir manifest
          /^\/favicon\.(svg|ico)$/,  // Excluir favicons
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
    dedupe: [
      'react',
      'react-dom',
      'react-is',
      'scheduler',
      'use-sync-external-store',
      'react-hot-toast',
      'goober',
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-is',
      'scheduler',
      'use-sync-external-store',
      'react-hot-toast',
      'goober',
    ],
  },
  define: {
    __PWA_BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Exponer en la red local
  },
  build: {
    // Optimizaciones de bundle size
    rollupOptions: {
      // Asegurar orden de dependencias para evitar problemas de carga
      preserveEntrySignatures: 'strict',
      output: {
        // SOLUCIÓN SIMPLIFICADA: Agrupar TODO React y dependencias en un solo chunk
        // El análisis recursivo y separaciones complejas causan errores de inicialización
        // "Cannot access 'kn' before initialization" debido a dependencias circulares
        manualChunks: (id) => {
          // Solo procesar node_modules (el código propio se mantiene junto)
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // CRÍTICO: Agrupar TODO React y ecosistema en react-vendor
          // Esto evita problemas de orden de inicialización dentro del chunk
          if (
            reactDepRegex.test(id) || // React core
            id.includes('node_modules/goober') ||
            id.includes('node_modules/react-hot-toast') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/@tanstack') ||
            id.includes('node_modules/@radix-ui') ||
            id.includes('node_modules/react-hook-form') ||
            id.includes('node_modules/react-day-picker') ||
            id.includes('node_modules/react-helmet-async') ||
            id.includes('node_modules/framer-motion') ||
            id.includes('node_modules/@hookform/resolvers') ||
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/dexie-react-hooks') ||
            id.includes('node_modules/recharts')
          ) {
            return 'react-vendor';
          }

          // Date-fns: biblioteca de fechas que NO depende de React (puede ir separada)
          if (id.includes('node_modules/date-fns')) {
            return 'date-fns-vendor';
          }

          // Resto de vendor (axios, dexie, zustand, socket.io, etc.)
          // Estas NO dependen de React y pueden ir en un chunk separado
          return 'vendor';
        },
        // Optimizar nombres de chunks para mejor cacheo
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Chunk size warning límite (500kb es razonable para PWAs)
    chunkSizeWarningLimit: 500,
    // Minificación automática (Vite usa terser/esbuild por defecto)
    minify: 'esbuild', // Más rápido que terser
    // Source maps para producción (deshabilitar si no son necesarios para reducir tamaño)
    sourcemap: false,
    // Optimizaciones adicionales
    cssCodeSplit: true, // Separar CSS en chunks
    // Tree shaking automático (habilitado por defecto en Vite)
  },
}));
