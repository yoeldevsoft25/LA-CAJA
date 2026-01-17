import { api } from '@/lib/api'

export type VariantType = 'size' | 'color' | 'material' | 'style' | 'other'

export interface ProductVariant {
  id: string
  product_id: string
  variant_type: VariantType | string
  variant_value: string
  sku: string | null
  barcode: string | null
  price_bs: number | string | null
  price_usd: number | string | null
  is_active: boolean
  created_at: string
  updated_at: string
  stock?: number
}

export interface CreateProductVariantRequest {
  product_id: string
  variant_type: VariantType | string
  variant_value: string
  sku?: string | null
  barcode?: string | null
  price_bs?: number | null
  price_usd?: number | null
  is_active?: boolean
}

export interface GroupedVariants {
  [variantType: string]: ProductVariant[]
}

export interface VariantStockResponse {
  variant_id: string
  stock: number
}

export const productVariantsService = {
  async createVariant(data: CreateProductVariantRequest): Promise<ProductVariant> {
    const response = await api.post<ProductVariant>('/product-variants', data)
    return response.data
  },

  async updateVariant(
    id: string,
    data: Partial<CreateProductVariantRequest>
  ): Promise<ProductVariant> {
    const response = await api.put<ProductVariant>(`/product-variants/${id}`, data)
    return response.data
  },

  async getVariantsByProduct(productId: string): Promise<ProductVariant[]> {
    const response = await api.get<ProductVariant[]>(`/product-variants/product/${productId}`)
    return response.data
  },

  async getVariantsGroupedByType(productId: string): Promise<GroupedVariants> {
    const response = await api.get<GroupedVariants>(
      `/product-variants/product/${productId}/grouped`
    )
    return response.data
  },

  async getVariantById(id: string): Promise<ProductVariant> {
    const response = await api.get<ProductVariant>(`/product-variants/${id}`)
    return response.data
  },

  async getVariantByBarcode(barcode: string): Promise<ProductVariant | null> {
    try {
      const response = await api.get<ProductVariant>(`/product-variants/barcode/${barcode}`)
      return response.data
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        return null
      }
      throw error
    }
  },

  async getVariantStock(id: string): Promise<number> {
    const response = await api.get<VariantStockResponse>(`/product-variants/${id}/stock`)
    return response.data.stock
  },

  async deleteVariant(id: string): Promise<void> {
    await api.delete(`/product-variants/${id}`)
  },
}
