import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

type AuthUser = import('./auth.store').AuthUser;
type UseAuth = typeof import('./auth.store').useAuth;

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
    let useAuth: UseAuth;

    beforeAll(async () => {
        // Import AFTER localStorage is defined so zustand persist picks up a real storage.
        ({ useAuth } = await import('./auth.store'));
    });

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
