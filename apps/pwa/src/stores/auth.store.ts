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
      // Persist API URL for SW usage
      import('@/lib/api').then(({ api }) => {
        if (api.defaults.baseURL) {
          db.kv.put({ key: 'api_url', value: api.defaults.baseURL }).catch(console.error);
        }
      });
      // Try to recover device_id if missing in SW context
      const deviceId = localStorage.getItem('device_id');
      if (deviceId) {
        db.kv.put({ key: 'device_id', value: deviceId }).catch(console.error);
      }
    } else {
      // Logout case: clean up credentials but keep device_id/api_url if needed for other things?
      // User requested "limpiar esos keys" (plural). Safe to clean auth_token, user_id, etc.
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
