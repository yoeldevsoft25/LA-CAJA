import { api } from '@/lib/api'
import type { PushSubscription } from '@/types/notifications.types'

/**
 * Servicio para manejar push notifications en PWA
 */
class PushNotificationsService {
  private readonly VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

  /**
   * Solicita permiso y suscribe a push notifications
   */
  async requestPermissionAndSubscribe(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PushNotifications] Push notifications no soportadas')
      return null
    }

    if (!this.VAPID_PUBLIC_KEY) {
      console.warn('[PushNotifications] VAPID_PUBLIC_KEY no configurada')
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

      // Convertir a formato para enviar al backend
      const pushSubscription: PushSubscription = {
        device_id: this.getDeviceId(),
        endpoint: subscription.endpoint,
        p256dh_key: this.arrayBufferToBase64(
          subscription.getKey('p256dh')?.buffer || new ArrayBuffer(0)
        ),
        auth_key: this.arrayBufferToBase64(
          subscription.getKey('auth')?.buffer || new ArrayBuffer(0)
        ),
        user_agent: navigator.userAgent,
      }

      // Enviar al backend
      await api.post('/notifications/push/subscribe', pushSubscription)
      console.log('[PushNotifications] Suscripción exitosa')

      return pushSubscription
    } catch (error) {
      console.error('[PushNotifications] Error suscribiéndose a push notifications', error)
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
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
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
