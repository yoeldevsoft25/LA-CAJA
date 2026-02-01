import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const buildId = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@la-caja/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@la-caja/sync': path.resolve(__dirname, '../../packages/sync/src/index.ts'),
    },
  },
  define: {
    __PWA_BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
