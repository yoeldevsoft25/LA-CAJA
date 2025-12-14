/**
 * Servicio para gestionar indicadores visuales de estado offline
 * Notifica cuando se pierde/recupera la conexión
 */

import toast from 'react-hot-toast';

class OfflineIndicatorService {
  private offlineToastId: string | null = null;
  private reconnectToastId: string | null = null;

  /**
   * Muestra notificación cuando se pierde la conexión
   */
  showOffline(): void {
    if (this.offlineToastId) return; // Ya está mostrando

    this.offlineToastId = toast.error(
      'Sin conexión a internet. Trabajando en modo offline.',
      {
        id: 'offline-indicator',
        duration: Infinity, // Permanecer hasta que vuelva la conexión
        icon: '📡',
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      }
    );
  }

  /**
   * Oculta la notificación offline y muestra que se recuperó la conexión
   */
  showOnline(): void {
    // Ocultar notificación offline
    if (this.offlineToastId) {
      toast.dismiss(this.offlineToastId);
      this.offlineToastId = null;
    }

    // Mostrar notificación de reconexión
    this.reconnectToastId = toast.success(
      'Conexión restaurada. Sincronizando...',
      {
        id: 'online-indicator',
        duration: 3000,
        icon: '✅',
      }
    );
  }

  /**
   * Limpia todas las notificaciones
   */
  clear(): void {
    if (this.offlineToastId) {
      toast.dismiss(this.offlineToastId);
      this.offlineToastId = null;
    }
    if (this.reconnectToastId) {
      toast.dismiss(this.reconnectToastId);
      this.reconnectToastId = null;
    }
  }
}

export const offlineIndicator = new OfflineIndicatorService();



