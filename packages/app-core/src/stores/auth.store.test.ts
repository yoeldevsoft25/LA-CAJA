import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth, type AuthUser } from './auth.store';

// Mock localStorage
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

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
});

describe('useAuth', () => {
    beforeEach(() => {
        localStorage.clear();
        useAuth.setState({ user: null, token: null, isAuthenticated: false });
    });

    it('should be initially unauthenticated', () => {
        const state = useAuth.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
    });

    it('should login', () => {
        const user: AuthUser = { user_id: '1', store_id: '1', role: 'owner', full_name: 'Test' };
        useAuth.getState().login('token', 'refresh', user);

        const state = useAuth.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.token).toBe('token');
    });
});
