import { api } from '@/lib/api'

export interface SupplierPriceListSummary {
  id: string
  name: string
  supplier_id: string | null
  supplier_name: string | null
  currency: 'USD' | 'BS'
  source_date: string | null
  imported_at: string
  is_active: boolean
  items_count: number
}

export interface SupplierPriceListItem {
  id: string
  list_id: string
  product_code: string
  product_name: string
  units_per_case: number | string | null
  price_a: number | string | null
  price_b: number | string | null
  unit_price_a: number | string | null
  unit_price_b: number | string | null
  supplier_name: string | null
  source_date: string | null
}

export interface SupplierPriceListSearchResponse {
  list: {
    id: string
    name: string
    supplier_id: string | null
    supplier_name: string | null
    currency: 'USD' | 'BS'
    source_date: string | null
  }
  items: SupplierPriceListItem[]
  total: number
}

export interface ImportSupplierPriceListRequest {
  csv: string
  supplier_id?: string | null
  supplier_name?: string | null
  list_name?: string | null
  currency?: 'USD' | 'BS'
}

export interface ImportSupplierPriceListResponse {
  total_rows: number
  imported_rows: number
  lists: Array<{ id: string; name: string; supplier_name: string; items: number }>
  errors: Array<{ row: number; message: string }>
}

export interface SearchSupplierPriceItemsParams {
  supplier_id?: string
  list_id?: string
  search?: string
  limit?: number
  offset?: number
}

export const supplierPriceListsService = {
  async importCSV(data: ImportSupplierPriceListRequest): Promise<ImportSupplierPriceListResponse> {
    const response = await api.post<ImportSupplierPriceListResponse>('/supplier-price-lists/import/csv', data)
    return response.data
  },

  async getLists(supplierId?: string): Promise<SupplierPriceListSummary[]> {
    const response = await api.get<SupplierPriceListSummary[]>('/supplier-price-lists', {
      params: supplierId ? { supplier_id: supplierId } : {},
    })
    return response.data
  },

  async searchItems(params: SearchSupplierPriceItemsParams): Promise<SupplierPriceListSearchResponse> {
    const response = await api.get<SupplierPriceListSearchResponse>('/supplier-price-lists/items', {
      params,
    })
    return response.data
  },
}
