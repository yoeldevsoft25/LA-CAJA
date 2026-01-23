import { api } from '@/lib/api'
import { db } from '@/db/database'
import type { LocalWhatsAppConfig } from '@/db/database'
import { createLogger } from '@/lib/logger'

const logger = createLogger('WhatsAppConfig')

export interface WhatsAppConfig {
  id: string
  store_id: string
  whatsapp_number: string | null
  thank_you_message: string | null
  enabled: boolean
  debt_notifications_enabled: boolean
  debt_reminders_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateWhatsAppConfigRequest {
  whatsapp_number?: string
  thank_you_message?: string
  enabled?: boolean
  debt_notifications_enabled?: boolean
  debt_reminders_enabled?: boolean
}

export interface UpdateWhatsAppConfigRequest {
  whatsapp_number?: string
  thank_you_message?: string
  enabled?: boolean
  debt_notifications_enabled?: boolean
  debt_reminders_enabled?: boolean
}

export interface WhatsAppStatus {
  isConnected: boolean
  whatsappNumber: string | null
  connectionState: string | null
}

export interface WhatsAppQRResponse {
  qrCode: string | null
  isConnected: boolean
}

/**
 * Servicio para gestión de configuración de WhatsApp con soporte offline-first
 */
export const whatsappConfigService = {
  /**
   * Obtiene la configuración de WhatsApp (con cache local)
   */
  async findOne(): Promise<WhatsAppConfig | null> {
    try {
      // Intentar obtener del servidor
      const response = await api.get<WhatsAppConfig>('/whatsapp/config')
      const config = response.data

      // Guardar localmente
      if (config) {
        await this.saveLocal(config.store_id, config)
      }

      return config
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        // No hay configuración
        return null
      }

      // Si hay error de red, intentar usar cache local
      // Nota: Para obtener storeId del cache, necesitaríamos decodificar el token JWT
      // Por ahora, retornamos null si no hay conexión
      if (!navigator.onLine) {
        logger.debug('Sin conexión, no se puede obtener configuración')
        return null
      }

      throw error
    }
  },

  /**
   * Crea o actualiza la configuración (guardar localmente primero)
   */
  async create(data: CreateWhatsAppConfigRequest): Promise<WhatsAppConfig> {
    // Intentar sincronizar con el servidor primero
    if (navigator.onLine) {
      try {
        const response = await api.post<WhatsAppConfig>('/whatsapp/config', data)
        const config = response.data

        // Guardar localmente
        await this.saveLocal(config.store_id, config)
        return config
      } catch (error) {
        logger.error('Error creando configuración', error)
        throw error
      }
    }

    // Si está offline, guardar localmente (necesitamos storeId del usuario)
    // Por ahora, lanzamos error si está offline (se puede mejorar obteniendo storeId del token)
    throw new Error('No se puede crear configuración sin conexión. Se requiere store_id.')
  },

  /**
   * Actualiza la configuración (guardar localmente primero)
   */
  async update(data: UpdateWhatsAppConfigRequest): Promise<WhatsAppConfig> {
    // Obtener configuración actual
    const current = await this.findOne()

    if (!current) {
      throw new Error('Configuración no encontrada. Cree una configuración primero.')
    }

    // Intentar sincronizar con el servidor
    if (navigator.onLine) {
      try {
        const response = await api.patch<WhatsAppConfig>('/whatsapp/config', data)
        const config = response.data

        // Actualizar local con datos del servidor
        await this.saveLocal(config.store_id, config)
        return config
      } catch (error) {
        logger.error('Error actualizando configuración', error)
        throw error
      }
    }

    // Si está offline, actualizar localmente
    const localConfig: LocalWhatsAppConfig = {
      id: current.id,
      store_id: current.store_id,
      whatsapp_number: data.whatsapp_number !== undefined ? data.whatsapp_number : current.whatsapp_number,
      thank_you_message: data.thank_you_message !== undefined ? data.thank_you_message : current.thank_you_message,
      enabled: data.enabled !== undefined ? data.enabled : current.enabled,
      debt_notifications_enabled: data.debt_notifications_enabled !== undefined ? data.debt_notifications_enabled : current.debt_notifications_enabled,
      debt_reminders_enabled: data.debt_reminders_enabled !== undefined ? data.debt_reminders_enabled : current.debt_reminders_enabled,
      updated_at: Date.now(),
      cached_at: Date.now(),
      sync_status: 'pending',
    }

    await db.whatsappConfigs.put(localConfig)

    // Retornar versión local actualizada
    return {
      id: localConfig.id,
      store_id: localConfig.store_id,
      whatsapp_number: localConfig.whatsapp_number,
      thank_you_message: localConfig.thank_you_message,
      enabled: localConfig.enabled,
      debt_notifications_enabled: localConfig.debt_notifications_enabled,
      debt_reminders_enabled: localConfig.debt_reminders_enabled,
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    }
  },

  /**
   * Obtiene el QR code para autenticación
   */
  async getQRCode(): Promise<WhatsAppQRResponse> {
    const response = await api.get<WhatsAppQRResponse>('/whatsapp/qr')
    return response.data
  },

  /**
   * Obtiene el estado de conexión del bot
   */
  async getStatus(): Promise<WhatsAppStatus> {
    const response = await api.get<WhatsAppStatus>('/whatsapp/status')
    return response.data
  },

  /**
   * Desconecta el bot manualmente
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/whatsapp/disconnect')
    return response.data
  },

  /**
   * Guarda configuración localmente
   */
  async saveLocal(storeId: string, config: WhatsAppConfig): Promise<void> {
    const localConfig: LocalWhatsAppConfig = {
      id: config.id,
      store_id: storeId,
      whatsapp_number: config.whatsapp_number,
      thank_you_message: config.thank_you_message,
      enabled: config.enabled,
      debt_notifications_enabled: config.debt_notifications_enabled,
      debt_reminders_enabled: config.debt_reminders_enabled,
      updated_at: new Date(config.updated_at).getTime(),
      cached_at: Date.now(),
      sync_status: 'synced',
    }

    await db.whatsappConfigs.put(localConfig)
  },

  /**
   * Obtiene configuración del cache local
   */
  async getLocal(storeId: string): Promise<WhatsAppConfig | null> {
    const local = await db.whatsappConfigs.where('store_id').equals(storeId).first()
    if (!local) return null

    return {
      id: local.id,
      store_id: local.store_id,
      whatsapp_number: local.whatsapp_number,
      thank_you_message: local.thank_you_message,
      enabled: local.enabled,
      debt_notifications_enabled: local.debt_notifications_enabled,
      debt_reminders_enabled: local.debt_reminders_enabled,
      created_at: new Date(local.cached_at).toISOString(),
      updated_at: new Date(local.updated_at).toISOString(),
    }
  },
}
