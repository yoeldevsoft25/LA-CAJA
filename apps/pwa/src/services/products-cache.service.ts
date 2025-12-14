/**
 * Servicio de Cache Local para Productos
 * Guarda productos en IndexedDB para acceso offline
 */

import { db, LocalProduct } from '@/db/database';
import { Product } from './products.service';

export class ProductsCacheService {
  /**
   * Convierte Product del API a LocalProduct
   */
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
      updated_at: new Date(product.updated_at).getTime(),
      cached_at: Date.now(),
    };
  }

  /**
   * Convierte LocalProduct a Product del API
   */
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
      updated_at: new Date(local.updated_at).toISOString(),
    };
  }

  /**
   * Guarda productos en cache local
   */
  async cacheProducts(products: Product[], storeId: string): Promise<void> {
    const localProducts = products.map(p => this.toLocalProduct(p, storeId));
    await db.cacheProducts(localProducts);
  }

  /**
   * Guarda un producto en cache local
   */
  async cacheProduct(product: Product, storeId: string): Promise<void> {
    const localProduct = this.toLocalProduct(product, storeId);
    await db.cacheProduct(localProduct);
  }

  /**
   * Obtiene productos del cache local
   */
  async getProductsFromCache(storeId: string, options?: {
    search?: string;
    category?: string;
    is_active?: boolean;
    limit?: number;
  }): Promise<Product[]> {
    const localProducts = await db.getProducts(storeId, options);
    return localProducts.map(local => this.toProduct(local));
  }

  /**
   * Obtiene un producto por ID del cache local
   */
  async getProductByIdFromCache(id: string): Promise<Product | null> {
    const local = await db.getProductById(id);
    return local ? this.toProduct(local) : null;
  }

  /**
   * Limpia productos antiguos del cache (más de 7 días sin actualizar)
   */
  async cleanupOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const oldProducts = await db.products
      .where('cached_at')
      .below(cutoff)
      .toArray();

    if (oldProducts.length > 0) {
      await db.products.bulkDelete(oldProducts.map(p => p.id));
    }
  }
}

export const productsCacheService = new ProductsCacheService();



