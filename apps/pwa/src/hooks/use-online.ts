/**
 * Hook para detectar estado de conectividad (online/offline)
 * Proporciona estado reactivo de conectividad y eventos de cambio
 */

import { useState, useEffect, useRef } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean; // Si estuvo offline y ahora está online
}

export function useOnline(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const setOnlineState = (online: boolean) => {
      setIsOnline((prev) => {
        if (prev === online) return prev;

        if (online) {
          setWasOffline(true);
          if (wasOfflineTimeoutRef.current) {
            window.clearTimeout(wasOfflineTimeoutRef.current);
          }
          wasOfflineTimeoutRef.current = window.setTimeout(() => {
            setWasOffline(false);
            wasOfflineTimeoutRef.current = null;
          }, 3000);
        } else {
          setWasOffline(false);
          if (wasOfflineTimeoutRef.current) {
            window.clearTimeout(wasOfflineTimeoutRef.current);
            wasOfflineTimeoutRef.current = null;
          }
        }

        return online;
      });
    };

    const handleOnline = () => setOnlineState(true);
    const handleOffline = () => setOnlineState(false);

    // Escuchar eventos de conectividad
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // También verificar periódicamente (por si los eventos no se disparan)
    const intervalId = setInterval(() => {
      setOnlineState(navigator.onLine);
    }, 5000); // Verificar cada 5 segundos

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
      if (wasOfflineTimeoutRef.current) {
        window.clearTimeout(wasOfflineTimeoutRef.current);
        wasOfflineTimeoutRef.current = null;
      }
    };
  }, []);

  return { isOnline, wasOffline };
}

