import { api } from '@/lib/api'

export interface Product {
  id: string
  store_id: string
  name: string
  category: string | null
  sku: string | null
  barcode: string | null
  price_bs: number | string // PostgreSQL devuelve NUMERIC como string
  price_usd: number | string
  cost_bs: number | string
  cost_usd: number | string
  low_stock_threshold: number
  is_active: boolean
  updated_at: string
}

export interface ProductSearchParams {
  q?: string
  category?: string
  is_active?: boolean
  limit?: number
  offset?: number
}

export interface ProductSearchResponse {
  products: Product[]
  total: number
}

export const productsService = {
  async search(params: ProductSearchParams): Promise<ProductSearchResponse> {
    // El backend usa 'search' en lugar de 'q'
    const backendParams = {
      ...params,
      search: params.q,
    }
    delete (backendParams as any).q
    
    const response = await api.get<ProductSearchResponse>('/products', { params: backendParams })
    return response.data
  },

  async getById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`)
    return response.data
  },

  async create(data: Partial<Product>): Promise<Product> {
    const response = await api.post<Product>('/products', data)
    return response.data
  },

  async update(id: string, data: Partial<Product>): Promise<Product> {
    const response = await api.patch<Product>(`/products/${id}`, data)
    return response.data
  },

  async deactivate(id: string): Promise<Product> {
    const response = await api.post<Product>(`/products/${id}/deactivate`)
    return response.data
  },

  async activate(id: string): Promise<Product> {
    const response = await api.post<Product>(`/products/${id}/activate`)
    return response.data
  },

  async changePrice(
    id: string,
    data: {
      price_bs: number
      price_usd: number
      rounding?: 'none' | '0.1' | '0.5' | '1'
    }
  ): Promise<Product> {
    const response = await api.patch<Product>(`/products/${id}/price`, data)
    return response.data
  },

  async bulkPriceChange(data: {
    items?: Array<{ product_id: string; price_bs?: number; price_usd?: number }>
    category?: string
    percentage_change?: number
    rounding?: 'none' | '0.1' | '0.5' | '1'
  }): Promise<{ updated: number; products: Product[] }> {
    const response = await api.put<{ updated: number; products: Product[] }>(
      '/products/prices/bulk',
      data
    )
    return response.data
  },
}

