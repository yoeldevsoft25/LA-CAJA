import { api } from '@/lib/api'

export interface CartItemDto {
  product_id: string
  qty: number
  discount_bs?: number
  discount_usd?: number
}

export interface CreateSaleRequest {
  items: CartItemDto[]
  exchange_rate: number
  currency: 'BS' | 'USD' | 'MIXED'
  payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'SPLIT' | 'FIAO'
  split?: {
    cash_bs?: number
    cash_usd?: number
    pago_movil_bs?: number
    transfer_bs?: number
    other_bs?: number
  }
  cash_payment?: {
    received_usd: number // Monto recibido en USD físico
    change_bs?: number // Cambio dado en Bs (si aplica)
  }
  cash_payment_bs?: {
    received_bs: number // Monto recibido en Bs físico
    change_bs?: number // Cambio dado en Bs (redondeado)
  }
  customer_id?: string
  customer_name?: string
  customer_document_id?: string
  customer_phone?: string
  customer_note?: string
  cash_session_id?: string
  note?: string | null
}

export interface SaleItem {
  id: string
  product_id: string
  qty: number
  unit_price_bs: number | string
  unit_price_usd: number | string
  discount_bs: number | string
  discount_usd: number | string
  product?: {
    id: string
    name: string
    sku?: string | null
    barcode?: string | null
  }
}

export interface Sale {
  id: string
  store_id: string
  cash_session_id: string | null
  customer_id: string | null
  sold_by_user_id: string | null
  sold_by_user?: {
    id: string
    full_name: string | null
  } | null
  customer?: {
    id: string
    name: string
    document_id: string | null
    phone: string | null
  } | null
  debt?: {
    id: string
    status: 'open' | 'partial' | 'paid'
    amount_bs: number | string
    amount_usd: number | string
    total_paid_bs?: number
    total_paid_usd?: number
    remaining_bs?: number
    remaining_usd?: number
  } | null
  exchange_rate: number | string
  currency: 'BS' | 'USD' | 'MIXED'
  totals: {
    subtotal_bs: number | string
    subtotal_usd: number | string
    discount_bs: number | string
    discount_usd: number | string
    total_bs: number | string
    total_usd: number | string
  }
  sold_at: string
  items: SaleItem[]
  payment: {
    method: string
    split?: {
      cash_bs?: number
      cash_usd?: number
      pago_movil_bs?: number
      transfer_bs?: number
      other_bs?: number
    }
  }
  note: string | null
}

export const salesService = {
  async create(data: CreateSaleRequest): Promise<Sale> {
    console.log('📤 [Frontend] Sending sale data (before cleaning):', {
      cash_session_id: data.cash_session_id,
      cash_session_id_type: typeof data.cash_session_id,
      payment_method: data.payment_method,
      items_count: data.items?.length,
    });
    
    // Filtrar campos undefined y cadenas vacías, pero mantener null explícitos
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined && value !== '')
    ) as CreateSaleRequest
    
    console.log('📤 [Frontend] Sending sale data (after cleaning):', {
      cash_session_id: cleanedData.cash_session_id,
      cash_session_id_type: typeof cleanedData.cash_session_id,
      hasCashSessionId: 'cash_session_id' in cleanedData,
      keys: Object.keys(cleanedData),
    });
    
    const response = await api.post<Sale>('/sales', cleanedData)
    return response.data
  },

  async getById(id: string): Promise<Sale> {
    const response = await api.get<Sale>(`/sales/${id}`)
    return response.data
  },

  async list(params?: {
    date_from?: string
    date_to?: string
    limit?: number
    offset?: number
    store_id?: string
  }): Promise<{ sales: Sale[]; total: number }> {
    const response = await api.get<{ sales: Sale[]; total: number }>('/sales', { params })
    return response.data
  },
}
