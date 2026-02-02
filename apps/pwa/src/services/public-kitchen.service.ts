import axios from 'axios'
import { ensurePrimaryPreferred, getApiBaseUrl } from '@/lib/api'

const publicApi = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

publicApi.interceptors.request.use(async (config) => {
  await ensurePrimaryPreferred()
  const baseUrl = getApiBaseUrl()
  config.baseURL = baseUrl
  if (baseUrl.includes('ngrok-free.dev')) {
    if (config.headers) {
      config.headers['ngrok-skip-browser-warning'] = '1'
    }
  }
  return config
})

export interface KitchenOrderItem {
  id: string
  product_name: string
  qty: number
  note: string | null
  status: 'pending' | 'preparing' | 'ready'
  added_at: string
}

export interface KitchenOrder {
  id: string
  order_number: string
  table_number: string
  table_name: string | null
  items: KitchenOrderItem[]
  created_at: string
  elapsed_time: number
}

export const publicKitchenService = {
  async getKitchenOrders(token: string, pin?: string): Promise<KitchenOrder[]> {
    const response = await publicApi.get<KitchenOrder[]>(
      `/public/kitchen/${token}/orders`,
      { params: pin ? { pin } : undefined }
    )
    return response.data
  },
}
