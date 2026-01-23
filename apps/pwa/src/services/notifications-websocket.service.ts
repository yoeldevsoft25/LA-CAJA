import { io, Socket } from 'socket.io-client'
import { createLogger } from '@/lib/logger'

const logger = createLogger('NotificationsWebSocket')

/**
 * Servicio WebSocket para notificaciones en tiempo real
 */
type EventCallback = (...args: unknown[]) => void

class NotificationsWebSocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()

  /**
   * Conecta al WebSocket de notificaciones
   */
  connect(storeId: string, userId: string): void {
    void storeId
    void userId
    if (this.socket?.connected) {
      return
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      logger.warn('No hay token de autenticación')
      return
    }

    // Obtener URL del API (usar la misma lógica que api.ts)
    let apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) {
      // Si estamos en localhost o preview local, usar localhost
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.port === '4173' || // Vite preview
        window.location.port === '5173'    // Vite dev server
      ) {
        apiUrl = 'http://localhost:3000'
      } else if (import.meta.env.PROD) {
        // En producción, intentar detectar automáticamente
        const hostname = window.location.hostname
        if (hostname.includes('netlify.app')) {
          apiUrl = 'https://la-caja-8i4h.onrender.com'
        } else {
          const protocol = window.location.protocol
          const port = protocol === 'https:' ? '' : ':3000'
          apiUrl = `${protocol}//${hostname}${port}`
        }
      } else {
        // En desarrollo, usar la misma IP para el API
        const hostname = window.location.hostname
        apiUrl = `http://${hostname}:3000`
      }
    }

    // Socket.IO funciona con HTTP/HTTPS, no necesita ws://
    // El namespace /notifications se agrega automáticamente
    this.socket = io(`${apiUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    this.setupEventListeners()
  }

  /**
   * Desconecta del WebSocket
   */
  disconnect(): void {
    if (this.socket) {
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
      logger.info('Conectado')
    })

    this.socket.on('disconnect', () => {
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
