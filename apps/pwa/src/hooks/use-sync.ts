/**
 * Hook de React para usar el servicio de sincronización
 * Proporciona estado y funciones para sincronización
 */

import { useEffect, useState, useCallback } from 'react';
import { syncService, SyncStatus } from '@/services/sync.service';
import { SyncMetrics } from '@la-caja/sync';
import { useAuth } from '@/stores/auth.store';

export function useSync() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  });
  const [metrics, setMetrics] = useState<SyncMetrics | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializar servicio cuando el usuario está autenticado
  useEffect(() => {
    if (!user || !user.store_id) {
      return;
    }

    // Obtener o generar device_id
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }

    // Inicializar servicio
    syncService
      .initialize(user.store_id, deviceId)
      .then(() => {
        setIsInitialized(true);
        updateStatus();
      })
      .catch((error) => {
        console.error('Error inicializando sync service:', error);
      });

    // Actualizar estado periódicamente
    const intervalId = setInterval(updateStatus, 2000); // Cada 2 segundos

    // Cleanup
    return () => {
      clearInterval(intervalId);
      syncService.stop();
      setIsInitialized(false);
    };
  }, [user]);

  // Actualizar estado y métricas
  const updateStatus = useCallback(() => {
    setStatus(syncService.getStatus());
    setMetrics(syncService.getMetrics());
  }, []);

  // Sincronizar ahora manualmente
  const syncNow = useCallback(async () => {
    try {
      await syncService.syncNow();
      updateStatus();
    } catch (error) {
      console.error('Error sincronizando:', error);
    }
  }, [updateStatus]);

  return {
    status,
    metrics,
    isInitialized,
    syncNow,
    refresh: updateStatus,
  };
}
