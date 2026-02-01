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

const VARIANTS_CACHE_TTL_MS = 1000 * 60 * 5
const variantsCache = new Map<string, { data: ProductVariant[]; fetchedAt: number }>()

function getCachedVariants(productId: string): ProductVariant[] | null {
  const cached = variantsCache.get(productId)
  if (!cached) return null
  if (Date.now() - cached.fetchedAt > VARIANTS_CACHE_TTL_MS) {
    variantsCache.delete(productId)
    return null
  }
  return cached.data
}

function setCachedVariants(productId: string, variants: ProductVariant[]) {
  variantsCache.set(productId, { data: variants, fetchedAt: Date.now() })
}

function invalidateVariantsCache(productId?: string) {
  if (productId) {
    variantsCache.delete(productId)
    return
  }
  variantsCache.clear()
}

export const productVariantsService = {
  /**
   * Crea una nueva variante de producto
   */
  async createVariant(data: CreateProductVariantRequest): Promise<ProductVariant> {
    const response = await api.post<ProductVariant>('/product-variants', data)
    invalidateVariantsCache(data.product_id)
    return response.data
  },

  /**
   * Actualiza una variante existente
   */
  async updateVariant(
    id: string,
    data: Partial<CreateProductVariantRequest>
  ): Promise<ProductVariant> {
    const response = await api.put<ProductVariant>(`/product-variants/${id}`, data)
    invalidateVariantsCache(data.product_id)
    return response.data
  },

  /**
   * Obtiene todas las variantes de un producto
   */
  async getVariantsByProduct(productId: string): Promise<ProductVariant[]> {
    const cached = getCachedVariants(productId)
    if (cached) return cached

    const response = await api.get<ProductVariant[]>(`/product-variants/product/${productId}`)
    const variants = response.data
    setCachedVariants(productId, variants)
    return variants
  },

  /**
   * Obtiene variantes agrupadas por tipo
   */
  async getVariantsGroupedByType(productId: string): Promise<GroupedVariants> {
    const response = await api.get<GroupedVariants>(
      `/product-variants/product/${productId}/grouped`
    )
    return response.data
  },

  /**
   * Obtiene una variante por su ID
   */
  async getVariantById(id: string): Promise<ProductVariant> {
    const response = await api.get<ProductVariant>(`/product-variants/${id}`)
    return response.data
  },

  /**
   * Obtiene una variante por código de barras
   */
  async getVariantByBarcode(barcode: string): Promise<ProductVariant | null> {
    try {
      const response = await api.get<ProductVariant>(`/product-variants/barcode/${barcode}`)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Obtiene el stock actual de una variante
   */
  async getVariantStock(id: string): Promise<number> {
    const response = await api.get<VariantStockResponse>(`/product-variants/${id}/stock`)
    return response.data.stock
  },

  /**
   * Elimina una variante (soft delete)
   */
  async deleteVariant(id: string): Promise<void> {
    await api.delete(`/product-variants/${id}`)
    invalidateVariantsCache()
  },
}
