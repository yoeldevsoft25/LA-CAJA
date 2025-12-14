import { api } from '@/lib/api'
import { productsCacheService } from './products-cache.service'

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
  async search(params: ProductSearchParams, storeId?: string): Promise<ProductSearchResponse> {
    const isOnline = navigator.onLine;

    // Si está offline, usar cache local
    if (!isOnline && storeId) {
      const cachedProducts = await productsCacheService.getProductsFromCache(storeId, {
        search: params.q,
        category: params.category,
        is_active: params.is_active,
        limit: params.limit,
      });

      return {
        products: cachedProducts,
        total: cachedProducts.length,
      };
    }

    // Si está online, obtener del API y guardar en cache
    try {
      const backendParams = {
        ...params,
        search: params.q,
      }
      delete (backendParams as any).q
      
      const response = await api.get<ProductSearchResponse>('/products', { params: backendParams })
      
      // Guardar en cache local para uso offline
      if (storeId && response.data.products.length > 0) {
        await productsCacheService.cacheProducts(response.data.products, storeId).catch(() => {
          // Silenciar errores de cache, no es crítico
        });
      }
      
      return response.data
    } catch (error: any) {
      // Si falla la petición y hay cache, usar cache como fallback
      if (storeId && error.code !== 'ERR_NETWORK') {
        throw error; // Re-lanzar si no es error de red
      }

      if (storeId) {
        const cachedProducts = await productsCacheService.getProductsFromCache(storeId, {
          search: params.q,
          category: params.category,
          is_active: params.is_active,
          limit: params.limit,
        });

        if (cachedProducts.length > 0) {
          return {
            products: cachedProducts,
            total: cachedProducts.length,
          };
        }
      }

      throw error;
    }
  },

  async getById(id: string, storeId?: string): Promise<Product> {
    const isOnline = navigator.onLine;

    // Si está offline, usar cache local
    if (!isOnline && storeId) {
      const cached = await productsCacheService.getProductByIdFromCache(id);
      if (cached) {
        return cached;
      }
      throw new Error('Producto no encontrado en cache local');
    }

    // Si está online, obtener del API y guardar en cache
    try {
      const response = await api.get<Product>(`/products/${id}`)
      
      // Guardar en cache
      if (storeId) {
        await productsCacheService.cacheProduct(response.data, storeId).catch(() => {
          // Silenciar errores de cache
        });
      }
      
      return response.data
    } catch (error: any) {
      // Si falla y hay cache, intentar desde cache
      if (storeId && error.code === 'ERR_NETWORK') {
        const cached = await productsCacheService.getProductByIdFromCache(id);
        if (cached) {
          return cached;
        }
      }
      throw error;
    }
  },

  async create(data: Partial<Product>, storeId?: string): Promise<Product> {
    const response = await api.post<Product>('/products', data)
    
    // Guardar en cache
    if (storeId) {
      await productsCacheService.cacheProduct(response.data, storeId).catch(() => {
        // Silenciar errores de cache
      });
    }
    
    return response.data
  },

  async update(id: string, data: Partial<Product>, storeId?: string): Promise<Product> {
    const response = await api.patch<Product>(`/products/${id}`, data)
    
    // Actualizar cache
    if (storeId) {
      await productsCacheService.cacheProduct(response.data, storeId).catch(() => {
        // Silenciar errores de cache
      });
    }
    
    return response.data
  },

  async deactivate(id: string, storeId?: string): Promise<Product> {
    const response = await api.post<Product>(`/products/${id}/deactivate`)
    
    // Actualizar cache
    if (storeId) {
      await productsCacheService.cacheProduct(response.data, storeId).catch(() => {});
    }
    
    return response.data
  },

  async activate(id: string, storeId?: string): Promise<Product> {
    const response = await api.post<Product>(`/products/${id}/activate`)
    
    // Actualizar cache
    if (storeId) {
      await productsCacheService.cacheProduct(response.data, storeId).catch(() => {});
    }
    
    return response.data
  },

  async changePrice(
    id: string,
    data: {
      price_bs: number
      price_usd: number
      rounding?: 'none' | '0.1' | '0.5' | '1'
    },
    storeId?: string
  ): Promise<Product> {
    const response = await api.patch<Product>(`/products/${id}/price`, data)
    
    // Actualizar cache
    if (storeId) {
      await productsCacheService.cacheProduct(response.data, storeId).catch(() => {});
    }
    
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

