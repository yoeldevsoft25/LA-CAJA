import axios from 'axios'

/**
 * Cliente API público (sin autenticación) para menú QR
 */
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

export interface PublicProduct {
  id: string
  name: string
  category: string | null
  price_bs: number
  price_usd: number
  description: string | null
  image_url: string | null
  is_available: boolean
  stock_available: number | null
}

export interface PublicMenuCategory {
  name: string
  products: PublicProduct[]
}

export interface PublicMenuResponse {
  categories: PublicMenuCategory[]
}

export interface PublicTableInfo {
  id: string
  table_number: string
  name: string | null
  capacity: number | null
  zone: string | null
}

export interface MenuByQRResponse {
  success: boolean
  table: PublicTableInfo
  menu: PublicMenuResponse
  qr_code: string
}

export const publicMenuService = {
  /**
   * Obtiene el menú y información de la mesa a partir de un código QR
   */
  async getMenuByQR(qrCode: string): Promise<MenuByQRResponse> {
    const response = await publicApi.get<MenuByQRResponse>(
      `/public/menu/qr/${qrCode}`
    )
    return response.data
  },

  /**
   * Obtiene información detallada de un producto
   */
  async getProduct(productId: string, qrCode: string): Promise<{
    success: boolean
    product: PublicProduct
  }> {
    const response = await publicApi.get<{
      success: boolean
      product: PublicProduct
    }>(`/public/menu/products/${productId}`, {
      params: { qrCode },
    })
    return response.data
  },

  /**
   * Crea una orden desde el menú público
   */
  async createOrder(qrCode: string, items: Array<{
    product_id: string
    qty: number
    note?: string | null
  }>): Promise<{
    success: boolean
    order: {
      id: string
      order_number: string
      status: string
      table_id: string | null
    }
  }> {
    const response = await publicApi.post<{
      success: boolean
      order: {
        id: string
        order_number: string
        status: string
        table_id: string | null
      }
    }>('/public/menu/orders', {
      qr_code: qrCode,
      items,
    })
    return response.data
  },

  /**
   * Obtiene la orden actual de una mesa por código QR
   */
  async getCurrentOrder(qrCode: string): Promise<{
    success: boolean
    has_order: boolean
    order: {
      id: string
      order_number: string
      status: string
      opened_at: string
    } | null
    items: Array<{
      id: string
      product_name: string
      qty: number
      status: 'pending' | 'preparing' | 'ready'
    }>
    progress: {
      totalItems: number
      pendingItems: number
      preparingItems: number
      readyItems: number
      orderStatus: string
    }
  }> {
    const response = await publicApi.get<{
      success: boolean
      has_order: boolean
      order: {
        id: string
        order_number: string
        status: string
        opened_at: string
      } | null
      items: Array<{
        id: string
        product_name: string
        qty: number
        status: 'pending' | 'preparing' | 'ready'
      }>
      progress: {
        totalItems: number
        pendingItems: number
        preparingItems: number
        readyItems: number
        orderStatus: string
      }
    }>('/public/menu/orders/current', {
      params: { qr_code: qrCode },
    })
    return response.data
  },
}
