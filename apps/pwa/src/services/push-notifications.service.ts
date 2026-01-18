import { api } from '@/lib/api'
import type { PushSubscription } from '@/types/notifications.types'

/**
 * Servicio para manejar push notifications en PWA
 */
class PushNotificationsService {
  private readonly VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

  /**
   * Verifica si las push notifications están disponibles y configuradas
   */
  isAvailable(): boolean {
    return (
      ('serviceWorker' in navigator) &&
      ('PushManager' in window) &&
      !!this.VAPID_PUBLIC_KEY
    )
  }

  /**
   * Solicita permiso y suscribe a push notifications
   */
  async requestPermissionAndSubscribe(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (import.meta.env.DEV) {
        console.debug('[PushNotifications] Push notifications no soportadas en este navegador')
      }
      return null
    }

    if (!this.VAPID_PUBLIC_KEY) {
      // En desarrollo, solo mostrar como debug para no saturar la consola
      if (import.meta.env.DEV) {
        console.debug('[PushNotifications] VAPID_PUBLIC_KEY no configurada (opcional en desarrollo)')
      }
      return null
    }

    try {
      // Solicitar permiso
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.warn('[PushNotifications] Permiso de notificaciones denegado')
        return null
      }

      // Registrar service worker
      const registration = await navigator.serviceWorker.ready

      // Suscribirse
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY),
      })

      // Validar que la suscripción tenga endpoint
      if (!subscription || !subscription.endpoint || typeof subscription.endpoint !== 'string' || !subscription.endpoint.trim()) {
        console.warn('[PushNotifications] La suscripción no tiene un endpoint válido')
        return null
      }

      // Convertir a formato para enviar al backend
      const p256dhKey = subscription.getKey('p256dh')
      const authKey = subscription.getKey('auth')
      
      // Validar que las claves estén presentes antes de continuar
      if (!p256dhKey || !authKey) {
        console.warn('[PushNotifications] Las claves de suscripción no están disponibles')
        return null
      }

      // Convertir claves a base64
      const p256dhKeyBase64 = this.arrayBufferToBase64(p256dhKey)
      const authKeyBase64 = this.arrayBufferToBase64(authKey)

      // Validar que las conversiones a base64 fueron exitosas
      if (!p256dhKeyBase64 || !p256dhKeyBase64.trim() || !authKeyBase64 || !authKeyBase64.trim()) {
        console.warn('[PushNotifications] Error al convertir claves a base64')
        return null
      }

      // Obtener device_id
      const deviceId = this.getDeviceId()
      if (!deviceId || !deviceId.trim()) {
        console.warn('[PushNotifications] No se pudo obtener o generar device_id')
        return null
      }

      const pushSubscription: PushSubscription = {
        device_id: deviceId,
        endpoint: subscription.endpoint.trim(),
        p256dh_key: p256dhKeyBase64.trim(),
        auth_key: authKeyBase64.trim(),
        user_agent: navigator.userAgent || undefined,
      }

      // Validar que todos los campos requeridos estén presentes
      if (!pushSubscription.device_id || !pushSubscription.endpoint || !pushSubscription.p256dh_key || !pushSubscription.auth_key) {
        console.error('[PushNotifications] Faltan campos requeridos en la suscripción:', {
          hasDeviceId: !!pushSubscription.device_id,
          hasEndpoint: !!pushSubscription.endpoint,
          hasP256dhKey: !!pushSubscription.p256dh_key,
          hasAuthKey: !!pushSubscription.auth_key,
        })
        return null
      }

      // Enviar al backend
      await api.post('/notifications/push/subscribe', pushSubscription)
      console.log('[PushNotifications] Suscripción exitosa')

      return pushSubscription
    } catch (error: any) {
      // Log detallado del error para debugging
      const errorMessage = error?.response?.data?.message || error?.message || 'Error desconocido'
      const errorStatus = error?.response?.status
      const errorData = error?.response?.data

      if (import.meta.env.DEV) {
        console.error('[PushNotifications] Error suscribiéndose a push notifications:', {
          message: errorMessage,
          status: errorStatus,
          data: errorData,
          fullError: error,
        })
      } else {
        // En producción, solo loguear mensaje simplificado
        console.warn(`[PushNotifications] Error al suscribirse: ${errorMessage}`)
      }

      return null
    }
  }

  /**
   * Desuscribe de push notifications
   */
  async unsubscribe(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await subscription.unsubscribe()
        await api.post('/notifications/push/unsubscribe', {
          device_id: this.getDeviceId(),
        })
        console.log('[PushNotifications] Desuscripción exitosa')
      }
    } catch (error) {
      console.error('[PushNotifications] Error desuscribiéndose de push notifications', error)
    }
  }

  /**
   * Verifica si está suscrito
   */
  async isSubscribed(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      return subscription !== null
    } catch {
      return false
    }
  }

  /**
   * Convierte VAPID key de base64 URL a Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    
    return outputArray
  }

  /**
   * Convierte ArrayBuffer a base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    
    return window.btoa(binary)
  }

  /**
   * Obtiene ID único del dispositivo
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('device_id', deviceId)
    }
    return deviceId
  }
}

export const pushNotificationsService = new PushNotificationsService()
