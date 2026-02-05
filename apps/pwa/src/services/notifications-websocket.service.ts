import { io, Socket } from 'socket.io-client'
import { createLogger } from '@/lib/logger'
import { getApiBaseUrl } from '@/lib/api'

const logger = createLogger('NotificationsWebSocket')

/**
 * Servicio WebSocket para notificaciones en tiempo real
 */
type EventCallback = (...args: unknown[]) => void

class NotificationsWebSocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()
  private isConnecting = false
  private connectivityListenersBound = false

  /**
   * Conecta al WebSocket de notificaciones
   */
  connect(storeId: string, userId: string): void {
    void storeId
    void userId
    if (!navigator.onLine) {
      logger.debug('Offline: se pospone conexión notifications')
      return
    }

    if (this.socket) {
      if (!this.socket.connected && !this.isConnecting) {
        this.isConnecting = true
        this.socket.connect()
      }
      return
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      logger.warn('No hay token de autenticación')
      return
    }

    const apiUrl = getApiBaseUrl()

    // Socket.IO funciona con HTTP/HTTPS, no necesita ws://
    // El namespace /notifications se agrega automáticamente
    this.socket = io(`${apiUrl}/notifications`, {
      auth: { token },
      extraHeaders: {
        'ngrok-skip-browser-warning': '1',
      },
      transports: ['polling', 'websocket'], // Priorizar polling para mayor compatibilidad (ej. ngrok)
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      reconnectionAttempts: 5,
      autoConnect: false,
    })

    this.bindConnectivityListeners()
    this.isConnecting = true
    this.socket.connect()
    this.setupEventListeners()
  }

  private bindConnectivityListeners(): void {
    if (this.connectivityListenersBound) return
    this.connectivityListenersBound = true

    window.addEventListener('offline', () => {
      if (this.socket) {
        this.isConnecting = false
        this.socket.disconnect()
      }
    })

    window.addEventListener('online', () => {
      if (this.socket && !this.socket.connected && !this.isConnecting) {
        this.isConnecting = true
        this.socket.connect()
      }
    })
  }

  /**
   * Desconecta del WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.isConnecting = false
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
    }
  }

  /**
   * Suscribe a notificaciones
   */
  subscribe(): void {
    this.socket?.emit('subscribe')
  }

  /**
   * Solicita notificaciones
   */
  getNotifications(params: { limit?: number; is_read?: boolean }): void {
    this.socket?.emit('get:notifications', params)
  }

  /**
   * Solicita badge de notificaciones
   */
  getBadge(category?: string): void {
    this.socket?.emit('get:badge', { category })
  }

  /**
   * Registra un listener para eventos
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(callback)
    this.socket?.on(event, callback)
  }

  /**
   * Elimina un listener de eventos
   */
  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
    this.socket?.off(event, callback)
  }

  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * Configura los event listeners base
   */
  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.isConnecting = false
      logger.info('Conectado')
    })

    this.socket.on('disconnect', () => {
      this.isConnecting = false
      logger.info('Desconectado')
    })

    this.socket.on('error', (error: { message?: string; data?: unknown; toString?: () => string }) => {
      // No mostrar errores de autenticación como errores críticos (son esperados cuando no hay token o el servidor no está disponible)
      const errorMessage = error?.message || error?.toString?.() || 'Error desconocido'
      if (errorMessage.includes('autenticado') || errorMessage.includes('auth')) {
        // Solo mostrar como warning, no como error crítico
        logger.debug('Autenticación requerida o servidor no disponible')
        return
      }
      logger.error('Error en WebSocket', new Error(errorMessage), { data: error?.data })
    })

    // Manejar errores de conexión
    this.socket.on('connect_error', (error: Error) => {
      this.isConnecting = false
      if (!navigator.onLine) return
      // Solo mostrar como debug en desarrollo, no inundar la consola
      if (import.meta.env.DEV) {
        logger.debug('Error de conexión (esperado si el backend no está corriendo)', { error: error.message })
      }
    })

    // Escuchar cambios de estado de licencia
    this.socket.on('license:status_change', (data: {
      license: {
        license_status: string
        license_expires_at: string | null
        license_plan: string | null
        license_grace_days: number
      }
      timestamp: number
    }) => {
      logger.debug('Cambio de estado de licencia', { status: data.license.license_status })
      // Emitir evento personalizado para que los hooks puedan escucharlo
      window.dispatchEvent(new CustomEvent('license:status_change', {
        detail: data.license,
      }))
    })
  }
}

export const notificationsWebSocketService = new NotificationsWebSocketService()
