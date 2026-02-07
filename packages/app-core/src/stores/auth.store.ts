import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
    user_id: string;
    store_id: string;
    role: 'owner' | 'cashier';
    full_name: string | null;
    license_status?: string;
    license_expires_at?: string | null;
    license_plan?: string | null;
    license_features?: string[];
}

export interface AuthState {
    user: AuthUser | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    showLoader: boolean;
    login: (token: string, refreshToken: string, user: AuthUser) => void;
    logout: () => void;
    setUser: (user: AuthUser) => void;
    setShowLoader: (show: boolean) => void;
    setToken: (token: string) => void;
}

export const useAuth = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            showLoader: false,
            login: (token, refreshToken, user) => {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('auth_token', token);
                    localStorage.setItem('refresh_token', refreshToken);
                }

                set({ token, refreshToken, user, isAuthenticated: true, showLoader: true });
            },
            logout: () => {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                }
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('hasSeenLoader');
                }

                set({ token: null, refreshToken: null, user: null, isAuthenticated: false, showLoader: false });
            },
            setUser: (user) => {
                set({ user });
            },
            setShowLoader: (show) => set({ showLoader: show }),
            setToken: (token) => {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('auth_token', token);
                }
                set({ token });
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => (typeof localStorage !== 'undefined' ? localStorage : ({} as any))),
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                token: state.token,
                refreshToken: state.refreshToken,
            }),
        }
    )
);
