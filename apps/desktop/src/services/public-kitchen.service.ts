import axios from 'axios'

function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '4173' ||
    window.location.port === '5173'
  ) {
    return 'http://localhost:3000'
  }

  if (import.meta.env.PROD) {
    const hostname = window.location.hostname
    if (hostname.includes('netlify.app')) {
      return 'https://la-caja-8i4h.onrender.com'
    }
    const protocol = window.location.protocol
    const port = protocol === 'https:' ? '' : ':3000'
    return `${protocol}//${hostname}${port}`
  }

  const hostname = window.location.hostname
  return `http://${hostname}:3000`
}

const publicApi = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
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
