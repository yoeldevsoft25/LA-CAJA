import { useAuth, type AuthState } from '@la-caja/app-core';
import { db } from '@/db/database';

// Re-export hook and types
export { useAuth };
export type { AuthUser } from '@la-caja/app-core';

// Side effects for Service Worker / IndexedDB sync
// This subscription keeps the local DB in sync with the store state
// which is needed for the Service Worker or other threads.
useAuth.subscribe((state: AuthState, prevState: AuthState) => {
  // Token handling
  if (state.token !== prevState.token) {
    if (state.token) {
      db.kv.put({ key: 'auth_token', value: state.token }).catch(console.error);
    } else {
      // Logout case: clean up everything
      db.kv.bulkDelete(['auth_token', 'refresh_token', 'user_id', 'store_id']).catch(console.error);
    }
  }

  // Refresh token handling
  if (state.refreshToken !== prevState.refreshToken && state.refreshToken) {
    db.kv.put({ key: 'refresh_token', value: state.refreshToken }).catch(console.error);
  }

  // User details handling
  if (state.user !== prevState.user && state.user) {
    db.kv.put({ key: 'user_id', value: state.user.user_id }).catch(console.error);
    db.kv.put({ key: 'store_id', value: state.user.store_id }).catch(console.error);
  }
});
// PWA specific
