/**
 * Setup file para Vitest
 * Se ejecuta antes de cada test
 * 
 * NOTA: Este archivo es SOLO para Vitest, NO para Playwright
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Limpiar DOM después de cada test
afterEach(() => {
  cleanup();
});

// ===== Mocks Globales =====

// Mock de IndexedDB
global.indexedDB = {
  open: vi.fn(() => {
    const request = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: {
        objectStoreNames: { contains: vi.fn(() => false) },
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            add: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            getAll: vi.fn(() => Promise.resolve([])),
          })),
        })),
      },
    } as any;
    return request;
  }),
  deleteDatabase: vi.fn(),
} as any;

// Mock de localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock de navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
  configurable: true,
});

// Mock de Service Worker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: vi.fn(() => Promise.resolve({
      ready: Promise.resolve({
        sync: {
          register: vi.fn(() => Promise.resolve()),
          getTags: vi.fn(() => Promise.resolve([])),
        },
      }),
    })),
    getRegistration: vi.fn(() => Promise.resolve(null)),
    getRegistrations: vi.fn(() => Promise.resolve([])),
  },
  writable: true,
  configurable: true,
});

// Mock de crypto.randomUUID (solo en entorno de Vitest/jsdom)
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  try {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        },
      },
      writable: true,
      configurable: true,
    });
  } catch (e) {
    // Ignorar si no se puede configurar (como en Playwright/Node.js)
    // crypto ya existe nativamente en esos entornos
  }
}

// Mock de window.matchMedia (para responsive)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock de ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock de IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;
