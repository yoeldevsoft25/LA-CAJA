import type { StorageAdapter } from './adapter';

/**
 * Web storage adapter using localStorage
 * Compatible with both PWA and Desktop (Tauri uses webview)
 */
export class WebStorageAdapter implements StorageAdapter {
    async getItem(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error('Error getting item from localStorage', error);
            return null;
        }
    }

    async setItem(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.error('Error setting item in localStorage', error);
        }
    }

    async removeItem(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing item from localStorage', error);
        }
    }

    async clear(): Promise<void> {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Error clearing localStorage', error);
        }
    }

    async keys(): Promise<string[]> {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            console.error('Error getting keys from localStorage', error);
            return [];
        }
    }
}
