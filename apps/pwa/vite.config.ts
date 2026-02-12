import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const buildId = process.env.PWA_BUILD_ID || new Date().toISOString();
const buildIdJson = JSON.stringify(buildId);
const BRAND = {
  blue: '#0D81CE',
  white: '#FFFFFF',
} as const;

const PWA_INCLUDE_ASSETS = [
  'favicon.ico',
  'favicon.svg',
  'logo-velox.svg',
  'logo-velox-white.svg',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
];

const PWA_ICONS = [
  {
    src: '/logo-velox.svg',
    sizes: 'any',
    type: 'image/svg+xml',
    purpose: 'any',
  },
  {
    src: '/logo-velox-white.svg',
    sizes: 'any',
    type: 'image/svg+xml',
    purpose: 'monochrome',
  },
  {
    src: '/android-chrome-192x192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any maskable',
  },
  {
    src: '/android-chrome-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  },
];
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
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest', // <== SWITCH TO INJECT MANIFEST
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: PWA_INCLUDE_ASSETS,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        // runtimeCaching is now in src/sw.ts
      },
      manifest: {
        name: 'Velox POS',
        short_name: 'Velox POS',
        description: 'Sistema POS Offline-First',
        theme_color: BRAND.blue,
        background_color: BRAND.white,
        lang: 'es',
        scope: '/',
        display: 'standalone',
        start_url: '/',
        icons: PWA_ICONS,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@la-caja/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@la-caja/sync': path.resolve(__dirname, '../../packages/sync/src/index.ts'),
      '@la-caja/offline-core': path.resolve(__dirname, '../../packages/offline-core/src/index.ts'),
      '@la-caja/api-client': path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
      '@la-caja/ui-core': path.resolve(__dirname, '../../packages/ui-core/src/index.ts'),
      '@la-caja/app-core': path.resolve(__dirname, '../../packages/app-core/src/index.ts'),
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
    // Asegurar que react-is se resuelva correctamente desde node_modules
    conditions: ['import', 'module', 'browser', 'default'],
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
      'recharts',
    ],
    // Asegurar que todas las dependencias de recharts se resuelvan
    esbuildOptions: {
      resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    },
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
    commonjsOptions: {
      // Asegurar que react-is se resuelva correctamente
      include: [/react-is/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      // Cambiar a 'allow-extension' para permitir más flexibilidad en el orden
      // 'strict' puede causar problemas de inicialización con dependencias circulares
      preserveEntrySignatures: 'allow-extension',
      // Asegurar que react-is se resuelva correctamente
      external: (id) => {
        // No externalizar react-is - debe estar en el bundle
        if (id === 'react-is') {
          return false;
        }
        return false; // No externalizar nada, todo debe estar en el bundle
      },
      output: {
        // SOLUCIÓN FUNCIONAL: Agrupar TODO React y dependencias en react-vendor
        // Date-fns puede ir separado porque NO depende de React
        // Esto garantiza el orden correcto de inicialización
        manualChunks: (id) => {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // Date-fns: biblioteca de fechas que NO depende de React (puede ir separada)
          if (id.includes('node_modules/date-fns')) {
            return 'date-fns-vendor';
          }

          // react-is debe estar en react-vendor para que recharts lo encuentre
          if (id.includes('react-is')) {
            return 'react-vendor';
          }

          // REVERSIÓN: Agrupar todo de nuevo en react-vendor para evitar errores de inicialización
          // El split actual causa 'Cannot access before initialization' en dependencias circulares de UI
          return 'react-vendor';
        },
        // Optimizar nombres de chunks para mejor cacheo
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Chunk size warning límite (2000kb para proyectos grandes)
    chunkSizeWarningLimit: 2000,
    // Minificación automática (Vite usa terser/esbuild por defecto)
    minify: 'esbuild', // Más rápido que terser
    // Source maps para producción (deshabilitar si no son necesarios para reducir tamaño)
    sourcemap: false,
    // Optimizaciones adicionales
    cssCodeSplit: true, // Separar CSS en chunks
    // Tree shaking automático (habilitado por defecto en Vite)
  },
}));
