/**
 * Servicio de Cache Local para Productos
 * Guarda productos en IndexedDB para acceso offline
 */

import { db, LocalProduct } from '@/db/database';
import { Product } from './products.service';
import { normalizeBarcode } from '@la-caja/domain';

export class ProductsCacheService {
  private barcodeIndex = new Map<string, LocalProduct>();
  private barcodeIndexStoreId: string | null = null;

  private shouldUseBarcodeIndex(storeId: string): boolean {
    return this.barcodeIndexStoreId === storeId && this.barcodeIndex.size > 0;
  }

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
      barcode: product.barcode ? normalizeBarcode(product.barcode) : null,
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
      cost_per_weight_bs:
        product.cost_per_weight_bs === null || product.cost_per_weight_bs === undefined
          ? null
          : typeof product.cost_per_weight_bs === 'string'
            ? parseFloat(product.cost_per_weight_bs)
            : product.cost_per_weight_bs,
      cost_per_weight_usd:
        product.cost_per_weight_usd === null || product.cost_per_weight_usd === undefined
          ? null
          : typeof product.cost_per_weight_usd === 'string'
            ? parseFloat(product.cost_per_weight_usd)
            : product.cost_per_weight_usd,
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
      image_url: product.image_url ?? null,
      description: product.description ?? null,
      is_recipe: product.is_recipe ?? false,
      profit_margin: product.profit_margin ?? 0,
      product_type: product.product_type ?? (product.is_recipe ? 'prepared' : 'sale_item'),
      is_visible_public: product.is_visible_public ?? false,
      public_name: product.public_name ?? null,
      public_description: product.public_description ?? null,
      public_image_url: product.public_image_url ?? null,
      public_category: product.public_category ?? null,
      ingredients: product.ingredients ?? undefined,
      updated_at: !isNaN(new Date(product.updated_at).getTime())
        ? new Date(product.updated_at).getTime()
        : Date.now(),
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
      is_weight_product: local.is_weight_product || false,
      weight_unit: local.weight_unit ?? null,
      price_per_weight_bs: local.price_per_weight_bs ?? null,
      price_per_weight_usd: local.price_per_weight_usd ?? null,
      cost_per_weight_bs: local.cost_per_weight_bs ?? null,
      cost_per_weight_usd: local.cost_per_weight_usd ?? null,
      min_weight: local.min_weight ?? null,
      max_weight: local.max_weight ?? null,
      scale_plu: local.scale_plu ?? null,
      scale_department: local.scale_department ?? null,
      image_url: local.image_url ?? null,
      description: local.description ?? null,
      is_recipe: local.is_recipe ?? false,
      profit_margin: local.profit_margin ?? 0,
      product_type: local.product_type ?? (local.is_recipe ? 'prepared' : 'sale_item'),
      is_visible_public: local.is_visible_public ?? false,
      public_name: local.public_name ?? null,
      public_description: local.public_description ?? null,
      public_image_url: local.public_image_url ?? null,
      public_category: local.public_category ?? null,
      ingredients: local.ingredients ?? undefined,
      updated_at: new Date(local.updated_at).toISOString(),
    };
  }

  /**
   * Guarda productos en cache local
   */
  async cacheProducts(products: Product[], storeId: string): Promise<void> {
    const localProducts = products.map(p => this.toLocalProduct(p, storeId));
    await db.cacheProducts(localProducts);
    if (this.barcodeIndexStoreId === storeId) {
      for (const local of localProducts) {
        if (local.barcode) {
          this.barcodeIndex.set(local.barcode, local);
        }
      }
    }
  }

  /**
   * Guarda un producto en cache local
   */
  async cacheProduct(product: Product, storeId: string): Promise<void> {
    const localProduct = this.toLocalProduct(product, storeId);
    await db.cacheProduct(localProduct);
    if (this.barcodeIndexStoreId === storeId && localProduct.barcode) {
      this.barcodeIndex.set(localProduct.barcode, localProduct);
    }
  }

  /**
   * Obtiene productos del cache local
   */
  async getProductsFromCache(storeId: string, options?: {
    search?: string;
    category?: string;
    is_active?: boolean;
    is_visible_public?: boolean;
    product_type?: 'sale_item' | 'ingredient' | 'prepared';
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
   * Obtiene un producto por barcode del cache local (rápido para escáner)
   */
  async getProductByBarcodeFromCache(storeId: string, barcode: string): Promise<Product | null> {
    const normalized = normalizeBarcode(barcode);
    const raw = barcode?.trim();
    const candidates = Array.from(new Set([normalized, raw].filter((value): value is string => !!value)));

    for (const candidate of candidates) {
      if (this.shouldUseBarcodeIndex(storeId)) {
        const cached = this.barcodeIndex.get(candidate);
        if (cached) return this.toProduct(cached);
      }

      const matches = await db.products.where('barcode').equals(candidate).toArray();
      const local = matches.find((p) => p.store_id === storeId && p.is_active);
      if (local) {
        if (this.barcodeIndexStoreId === storeId) {
          this.barcodeIndex.set(candidate, local);
        }
        return this.toProduct(local);
      }
    }

    return null;
  }

  /**
   * Precarga índice de barcodes en memoria para escaneo ultra rápido
   */
  async warmBarcodeIndex(storeId: string): Promise<void> {
    // ✅ Sanitización robusta de storeId
    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
      console.debug('[ProductsCache] warmBarcodeIndex skipped: invalid storeId');
      return;
    }

    const sanitizedStoreId = storeId.trim();
    if (this.barcodeIndexStoreId === sanitizedStoreId && this.barcodeIndex.size > 0) return;

    try {
      // ✅ Fix: Remove "as unknown as string" casting which confuses Dexie if types don't match exactly at runtime
      // Ensure we pass a proper array for compound index
      const locals = await db.products
        .where('[store_id+is_active]')
        .equals([sanitizedStoreId, 1 /* 1 = true for boolean index sometimes in Dexie/IndexedDB depending on adapter */])
        .or('store_id').equals(sanitizedStoreId).and(p => p.is_active === true) // Fallback query if compound index fails
        .toArray();

      // Optimization: If the fallback approach is too slow, stick to simple filter if compound index issues persist
      // But [store_id+is_active] should work if defined in database.ts stores()

      this.barcodeIndex.clear();
      this.barcodeIndexStoreId = sanitizedStoreId;
      for (const local of locals) {
        if (local.barcode && typeof local.barcode === 'string') {
          const bar = local.barcode.trim();
          if (bar) {
            const normalized = normalizeBarcode(bar) ?? bar;
            this.barcodeIndex.set(normalized, local);
          }
        }
      }
    } catch (err: unknown) {
      // Catch DataError or other IDB errors - log as debug to avoid console spam
      // "DataError" often happens if one of the keys in compound index is missing/invalid type
      const errorName = err instanceof Error ? err.name : 'UnknownError';
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorName === 'DataError') {
        console.debug('[ProductsCache] warmBarcodeIndex DataError (safely ignored, falling back to db search)', errorMessage);
      } else {
        console.warn('[ProductsCache] warmBarcodeIndex failed', err);
      }
    }
  }
  /**
   * Limpia productos antiguos del cache (más de 7 días sin actualizar)
   */
  async cleanupOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;

    // Ensure cutoff is a valid number
    if (isNaN(cutoff)) return;

    try {
      const oldProducts = await db.products
        .where('cached_at')
        .below(cutoff)
        .toArray();

      if (oldProducts.length > 0) {
        await db.products.bulkDelete(oldProducts.map(p => p.id));
      }
    } catch (err) {
      console.warn('cleanupOldCache failed', err);
    }
  }
}

export const productsCacheService = new ProductsCacheService();
