import { api } from '@/lib/api'

/**
 * Lista de precio
 */
export interface PriceList {
  id: string
  store_id: string
  name: string
  code: string
  description: string | null
  is_default: boolean
  is_active: boolean
  valid_from: string | null
  valid_until: string | null
  note: string | null
  created_at: string
  updated_at: string
  items?: PriceListItem[]
}

/**
 * Item de lista de precio
 */
export interface PriceListItem {
  id: string
  price_list_id: string
  product_id: string
  variant_id: string | null
  price_bs: number | string
  price_usd: number | string
  min_qty: number | null
  note: string | null
  created_at: string
  updated_at: string
  product?: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
  }
  variant?: {
    id: string
    variant_type: string
    variant_value: string
  } | null
}

/**
 * DTO para crear una lista de precio
 */
export interface CreatePriceListDto {
  name: string
  code: string
  description?: string | null
  is_default?: boolean
  is_active?: boolean
  valid_from?: string | null
  valid_until?: string | null
  note?: string | null
}

/**
 * DTO para agregar un item a una lista de precio
 */
export interface CreatePriceListItemDto {
  product_id: string
  variant_id?: string | null
  price_bs: number
  price_usd: number
  min_qty?: number | null
  note?: string | null
}

export const priceListsService = {
  /**
   * Crea una nueva lista de precio
   */
  async create(data: CreatePriceListDto): Promise<PriceList> {
    const response = await api.post<PriceList>('/price-lists', data)
    return response.data
  },

  /**
   * Obtiene todas las listas de precio
   */
  async getAll(): Promise<PriceList[]> {
    const response = await api.get<PriceList[]>('/price-lists')
    return response.data
  },

  /**
   * Obtiene la lista de precio por defecto
   */
  async getDefault(): Promise<PriceList | null> {
    try {
      const response = await api.get<PriceList>('/price-lists/default')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Obtiene una lista por ID
   */
  async getById(id: string): Promise<PriceList> {
    const response = await api.get<PriceList>(`/price-lists/${id}`)
    return response.data
  },

  /**
   * Agrega un item a una lista de precio
   */
  async addItem(listId: string, data: CreatePriceListItemDto): Promise<PriceListItem> {
    const response = await api.post<PriceListItem>(`/price-lists/${listId}/items`, data)
    return response.data
  },
}

