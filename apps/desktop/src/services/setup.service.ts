import { api } from '@/lib/api'

export type BusinessType = 'retail' | 'services' | 'restaurant' | 'general'

export interface SetupConfig {
  business_type?: BusinessType
  business_name?: string
  fiscal_id?: string
  address?: string
  phone?: string
  email?: string
  currency?: 'BS' | 'USD' | 'MIXED'
}

export interface SetupResult {
  success: boolean
  steps_completed: string[]
  steps_failed: string[]
  details: {
    warehouse_created?: boolean
    price_list_created?: boolean
    chart_of_accounts_initialized?: boolean
    invoice_series_created?: boolean
    payment_methods_configured?: boolean
  }
}

export interface SetupValidation {
  is_complete: boolean
  missing_steps: string[]
  details: {
    has_warehouse: boolean
    has_price_list: boolean
    has_chart_of_accounts: boolean
    has_invoice_series: boolean
    has_products?: boolean
  }
}

/**
 * Servicio para setup automático y onboarding
 */
export const setupService = {
  /**
   * Ejecutar setup automático completo
   */
  async runSetup(config: SetupConfig): Promise<SetupResult> {
    const response = await api.post<SetupResult>('/setup/run', config)
    return response.data
  },

  /**
   * Validar estado de configuración
   */
  async validateSetup(): Promise<SetupValidation> {
    const response = await api.get<SetupValidation>('/setup/validate')
    return response.data
  },
}