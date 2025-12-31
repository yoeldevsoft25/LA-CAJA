import { api } from '@/lib/api'

export type PeripheralType = 'scanner' | 'printer' | 'drawer' | 'scale' | 'customer_display'
export type ConnectionType = 'serial' | 'usb' | 'network' | 'bluetooth' | 'web_serial'

export interface ConnectionConfig {
  serialPort?: string
  baudRate?: number
  dataBits?: number
  stopBits?: number
  parity?: string
  host?: string
  networkPort?: number
  deviceId?: string
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>
  printer?: {
    paperWidth?: number
    encoding?: string
  }
  scale?: {
    protocol?: string
    unit?: string
  }
  scanner?: {
    prefix?: string
    suffix?: string
    length?: number
  }
}

export interface PeripheralConfig {
  id: string
  store_id: string
  peripheral_type: PeripheralType
  name: string
  connection_type: ConnectionType
  connection_config: ConnectionConfig
  is_active: boolean
  is_default: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export interface CreatePeripheralConfigRequest {
  peripheral_type: PeripheralType
  name: string
  connection_type: ConnectionType
  connection_config: ConnectionConfig
  is_active?: boolean
  is_default?: boolean
  note?: string | null
}

export interface UpdatePeripheralConfigRequest {
  name?: string
  connection_type?: ConnectionType
  connection_config?: ConnectionConfig
  is_active?: boolean
  is_default?: boolean
  note?: string | null
}

export const peripheralsService = {
  /**
   * Crea una nueva configuración de periférico
   */
  async createConfig(data: CreatePeripheralConfigRequest): Promise<PeripheralConfig> {
    const response = await api.post<PeripheralConfig>('/peripherals', data)
    return response.data
  },

  /**
   * Obtiene todas las configuraciones de periféricos
   */
  async getConfigsByStore(type?: PeripheralType): Promise<PeripheralConfig[]> {
    const params = type ? `?type=${type}` : ''
    const response = await api.get<PeripheralConfig[]>(`/peripherals${params}`)
    return response.data
  },

  /**
   * Obtiene la configuración por defecto de un tipo
   */
  async getDefaultConfig(type: PeripheralType): Promise<PeripheralConfig | null> {
    try {
      const response = await api.get<PeripheralConfig>(`/peripherals/default/${type}`)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Obtiene una configuración por ID
   */
  async getConfigById(id: string): Promise<PeripheralConfig> {
    const response = await api.get<PeripheralConfig>(`/peripherals/${id}`)
    return response.data
  },

  /**
   * Actualiza una configuración de periférico
   */
  async updateConfig(
    id: string,
    data: UpdatePeripheralConfigRequest
  ): Promise<PeripheralConfig> {
    const response = await api.put<PeripheralConfig>(`/peripherals/${id}`, data)
    return response.data
  },

  /**
   * Marca una configuración como por defecto
   */
  async setAsDefault(id: string): Promise<PeripheralConfig> {
    const response = await api.put<PeripheralConfig>(`/peripherals/${id}/set-default`, {})
    return response.data
  },

  /**
   * Elimina una configuración de periférico
   */
  async deleteConfig(id: string): Promise<void> {
    await api.delete(`/peripherals/${id}`)
  },
}











