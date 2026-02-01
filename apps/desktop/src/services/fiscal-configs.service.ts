import { api } from '@/lib/api'

export interface FiscalConfig {
  id: string
  store_id: string
  tax_id: string
  business_name: string
  business_address: string
  business_phone?: string | null
  business_email?: string | null
  default_tax_rate: number
  fiscal_authorization_number?: string | null
  fiscal_authorization_date?: string | null
  fiscal_authorization_expiry?: string | null
  fiscal_control_system?: string | null
  is_active: boolean
  note?: string | null
  created_at: string
  updated_at: string
}

export interface CreateFiscalConfigRequest {
  tax_id: string
  business_name: string
  business_address: string
  business_phone?: string
  business_email?: string
  default_tax_rate?: number
  fiscal_authorization_number?: string
  fiscal_authorization_date?: string
  fiscal_authorization_expiry?: string
  fiscal_control_system?: string
  note?: string
}

export interface UpdateFiscalConfigRequest {
  tax_id?: string
  business_name?: string
  business_address?: string
  business_phone?: string
  business_email?: string
  default_tax_rate?: number
  fiscal_authorization_number?: string
  fiscal_authorization_date?: string
  fiscal_authorization_expiry?: string
  fiscal_control_system?: string
  is_active?: boolean
  note?: string
}

export const fiscalConfigsService = {
  /**
   * Crea o actualiza la configuración fiscal (upsert)
   */
  async create(data: CreateFiscalConfigRequest): Promise<FiscalConfig> {
    const response = await api.post<FiscalConfig>('/fiscal-configs', data)
    return response.data
  },

  /**
   * Obtiene la configuración fiscal de la tienda
   */
  async findOne(): Promise<FiscalConfig | null> {
    try {
      const response = await api.get<FiscalConfig>('/fiscal-configs')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Actualiza la configuración fiscal
   */
  async update(data: UpdateFiscalConfigRequest): Promise<FiscalConfig> {
    const response = await api.put<FiscalConfig>('/fiscal-configs', data)
    return response.data
  },
}

