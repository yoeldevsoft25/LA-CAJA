import { api } from '@/lib/api'

export interface BCVRateResponse {
  rate: number | null
  source: 'api' | 'manual' | null
  timestamp: string | null
  available: boolean
  message?: string
}

export const exchangeService = {
  async getBCVRate(force = false): Promise<BCVRateResponse> {
    const response = await api.get<BCVRateResponse>('/exchange/bcv', {
      params: force ? { force: 'true' } : {},
    })
    return response.data
  },
}

