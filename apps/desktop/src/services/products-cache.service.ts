import { db, LocalProduct } from '@/db/database'
import { Product } from './products.service'

export class ProductsCacheService {
  private toLocalProduct(product: Product, storeId: string): LocalProduct {
    return {
      id: product.id,
      store_id: storeId,
      name: product.name,
      category: product.category || null,
      sku: product.sku || null,
      barcode: product.barcode || null,
      price_bs: typeof product.price_bs === 'string' ? parseFloat(product.price_bs) : product.price_bs,
      price_usd: typeof product.price_usd === 'string' ? parseFloat(product.price_usd) : product.price_usd,
      cost_bs: typeof product.cost_bs === 'string' ? parseFloat(product.cost_bs) : product.cost_bs,
      cost_usd: typeof product.cost_usd === 'string' ? parseFloat(product.cost_usd) : product.cost_usd,
      low_stock_threshold: product.low_stock_threshold,
      is_active: product.is_active,
      is_weight_product: product.is_weight_product || false,
      weight_unit: product.weight_unit || null,
      price_per_weight_bs:
        product.price_per_weight_bs === null || product.price_per_weight_bs === undefined
          ? null
          : typeof product.price_per_weight_bs === 'string'
            ? parseFloat(product.price_per_weight_bs)
            : product.price_per_weight_bs,
      price_per_weight_usd:
        product.price_per_weight_usd === null || product.price_per_weight_usd === undefined
          ? null
          : typeof product.price_per_weight_usd === 'string'
            ? parseFloat(product.price_per_weight_usd)
            : product.price_per_weight_usd,
      min_weight:
        product.min_weight === null || product.min_weight === undefined
          ? null
          : typeof product.min_weight === 'string'
            ? parseFloat(product.min_weight)
            : product.min_weight,
      max_weight:
        product.max_weight === null || product.max_weight === undefined
          ? null
          : typeof product.max_weight === 'string'
            ? parseFloat(product.max_weight)
            : product.max_weight,
      scale_plu: product.scale_plu ?? null,
      scale_department: product.scale_department ?? null,
      updated_at: new Date(product.updated_at).getTime(),
      cached_at: Date.now(),
    }
  }

  private toProduct(local: LocalProduct): Product {
    return {
      id: local.id,
      store_id: local.store_id,
      name: local.name,
      category: local.category,
      sku: local.sku,
      barcode: local.barcode,
      price_bs: local.price_bs,
      price_usd: local.price_usd,
      cost_bs: local.cost_bs,
      cost_usd: local.cost_usd,
      low_stock_threshold: local.low_stock_threshold,
      is_active: local.is_active,
      is_weight_product: local.is_weight_product || false,
      weight_unit: local.weight_unit ?? null,
      price_per_weight_bs: local.price_per_weight_bs ?? null,
      price_per_weight_usd: local.price_per_weight_usd ?? null,
      min_weight: local.min_weight ?? null,
      max_weight: local.max_weight ?? null,
      scale_plu: local.scale_plu ?? null,
      scale_department: local.scale_department ?? null,
      updated_at: new Date(local.updated_at).toISOString(),
    }
  }

  async cacheProducts(products: Product[], storeId: string): Promise<void> {
    const localProducts = products.map((product) => this.toLocalProduct(product, storeId))
    await db.cacheProducts(localProducts)
  }

  async cacheProduct(product: Product, storeId: string): Promise<void> {
    const localProduct = this.toLocalProduct(product, storeId)
    await db.cacheProduct(localProduct)
  }

  async getProductsFromCache(
    storeId: string,
    options?: {
      search?: string
      category?: string
      is_active?: boolean
      limit?: number
    }
  ): Promise<Product[]> {
    const localProducts = await db.getProducts(storeId, options)
    return localProducts.map((local) => this.toProduct(local))
  }

  async getProductByIdFromCache(id: string): Promise<Product | null> {
    const local = await db.getProductById(id)
    return local ? this.toProduct(local) : null
  }

  async cleanupOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge
    const oldProducts = await db.products.where('cached_at').below(cutoff).toArray()

    if (oldProducts.length > 0) {
      await db.products.bulkDelete(oldProducts.map((product) => product.id))
    }
  }
}

export const productsCacheService = new ProductsCacheService()
