import { io, Socket } from 'socket.io-client'
import {
  RealTimeMetric,
  RealTimeAlert,
  SalesHeatmapData,
  ExchangeRateUpdate,
} from '@/types/realtime-analytics.types'
import { createLogger } from '@/lib/logger'
import { getApiBaseUrl } from '@/lib/api'

const logger = createLogger('RealtimeWebSocket')

type MetricUpdateCallback = (metric: RealTimeMetric) => void
type AlertNewCallback = (alert: RealTimeAlert) => void
type HeatmapUpdateCallback = (data: SalesHeatmapData[]) => void
type ExchangeRateUpdateCallback = (data: ExchangeRateUpdate) => void
type ErrorCallback = (error: string) => void

class RealtimeWebSocketService {
  private socket: Socket | null = null
  private isConnected = false
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  // Callbacks
  private metricUpdateCallbacks: Set<MetricUpdateCallback> = new Set()
  private alertNewCallbacks: Set<AlertNewCallback> = new Set()
  private heatmapUpdateCallbacks: Set<HeatmapUpdateCallback> = new Set()
  private exchangeRateUpdateCallbacks: Set<ExchangeRateUpdateCallback> = new Set()
  private errorCallbacks: Set<ErrorCallback> = new Set()

  /**
   * Conecta al WebSocket
   */
  connect(): void {
    if (this.socket?.connected) {
      return
    }

    const token = localStorage.getItem('auth_token')
    if (!token) {
      logger.warn('No hay token de autenticación')
      return
    }

    const apiUrl = getApiBaseUrl()

    // Socket.IO funciona con HTTP/HTTPS, no necesita ws://
    // El namespace /realtime se agrega automáticamente
    this.socket = io(`${apiUrl}/realtime`, {
      auth: {
        token,
      },
      extraHeaders: {
        'ngrok-skip-browser-warning': '1',
      },
      transports: ['polling', 'websocket'], // Priorizar polling para mayor compatibilidad (ej. ngrok)
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    })

    this.setupEventHandlers()
  }

  /**
   * Configura los event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.isConnected = true
      logger.info('Conectado')
    })

    this.socket.on('disconnect', () => {
      this.isConnected = false
      logger.info('Desconectado')
    })

    this.socket.on('connected', (data?: { message?: string }) => {
      if (data?.message) {
        logger.debug('Connected message', { message: data.message })
      }
    })

    this.socket.on('subscribed', (data: { channel: string }) => {
      logger.debug('Suscrito a canal', { channel: data.channel })
    })

    this.socket.on('metric:update', (metric: RealTimeMetric) => {
      this.metricUpdateCallbacks.forEach((callback) => callback(metric))
    })

    this.socket.on('alert:new', (alert: RealTimeAlert) => {
      this.alertNewCallbacks.forEach((callback) => callback(alert))
    })

    this.socket.on('heatmap:update', (data: SalesHeatmapData[]) => {
      this.heatmapUpdateCallbacks.forEach((callback) => callback(data))
    })

    this.socket.on('exchange:update', (data: ExchangeRateUpdate) => {
      this.exchangeRateUpdateCallbacks.forEach((callback) => callback(data))
    })

    // Escuchar cambios de estado de licencia desde el namespace de notificaciones
    // Nota: Los eventos de licencia se emiten desde /notifications, no /realtime
    // Necesitamos escuchar en el socket de notificaciones

    this.socket.on('error', (error: { message?: string }) => {
      const errorMessage = error?.message || 'Error desconocido'
      // No mostrar errores de autenticación como errores críticos
      if (errorMessage.includes('autenticado') || errorMessage.includes('auth')) {
        logger.debug('Autenticación requerida o servidor no disponible')
        return
      }
      logger.error('Error en WebSocket', new Error(errorMessage))
      this.errorCallbacks.forEach((callback) => callback(errorMessage))
    })

    // Manejar errores de conexión
    this.socket.on('connect_error', (error: Error) => {
      // Solo mostrar como debug en desarrollo, no inundar la consola
      if (import.meta.env.DEV) {
        logger.debug('Error de conexión (esperado si el backend no está corriendo)', { error: error.message })
      }
    })
  }

  /**
   * Suscribe a métricas
   */
  subscribeToMetrics(metricTypes?: string[]): void {
    if (!this.socket?.connected) {
      logger.warn('No conectado, no se puede suscribir')
      return
    }

    this.socket.emit('subscribe:metrics', { metric_types: metricTypes })
  }

  /**
   * Suscribe a alertas
   */
  subscribeToAlerts(): void {
    if (!this.socket?.connected) {
      logger.warn('No conectado, no se puede suscribir')
      return
    }

    this.socket.emit('subscribe:alerts')
  }

  /**
   * Obtiene métricas actuales
   */
  getMetrics(metricTypes?: string[]): Promise<RealTimeMetric[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('No conectado'))
        return
      }

      this.socket.emit('get:metrics', { metric_types: metricTypes }, (data: { metrics: RealTimeMetric[] }) => {
        resolve(data.metrics)
      })
    })
  }

  /**
   * Obtiene alertas actuales
   */
  getAlerts(): Promise<RealTimeAlert[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('No conectado'))
        return
      }

      this.socket.emit('get:alerts', {}, (data: { alerts: RealTimeAlert[] }) => {
        resolve(data.alerts)
      })
    })
  }

  /**
   * Registra callback para actualizaciones de métricas
   */
  onMetricUpdate(callback: MetricUpdateCallback): () => void {
    this.metricUpdateCallbacks.add(callback)
    return () => {
      this.metricUpdateCallbacks.delete(callback)
    }
  }

  /**
   * Registra callback para nuevas alertas
   */
  onAlertNew(callback: AlertNewCallback): () => void {
    this.alertNewCallbacks.add(callback)
    return () => {
      this.alertNewCallbacks.delete(callback)
    }
  }

  /**
   * Registra callback para actualizaciones de heatmap
   */
  onHeatmapUpdate(callback: HeatmapUpdateCallback): () => void {
    this.heatmapUpdateCallbacks.add(callback)
    return () => {
      this.heatmapUpdateCallbacks.delete(callback)
    }
  }

  /**
   * Registra callback para actualizaciones de tasa de cambio
   */
  onExchangeRateUpdate(callback: ExchangeRateUpdateCallback): () => void {
    this.exchangeRateUpdateCallbacks.add(callback)
    return () => {
      this.exchangeRateUpdateCallbacks.delete(callback)
    }
  }

  /**
   * Registra callback para errores
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback)
    return () => {
      this.errorCallbacks.delete(callback)
    }
  }

  /**
   * Desconecta del WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  /**
   * Verifica si está conectado
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true
  }
}

// Singleton instance
export const realtimeWebSocketService = new RealtimeWebSocketService()
