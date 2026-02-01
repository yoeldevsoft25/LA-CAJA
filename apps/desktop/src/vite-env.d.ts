/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PRIMARY_API_URL: string;
  readonly VITE_FALLBACK_API_URL: string;
  // más variables de entorno...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __PWA_BUILD_ID__: string;
