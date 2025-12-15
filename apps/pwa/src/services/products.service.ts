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

    // ESTRATEGIA: Stale-While-Revalidate
    // 1. SIEMPRE intentar cargar desde cache primero (incluso online)
    // 2. Si hay cache, retornarlo inmediatamente
    // 3. Si está online, actualizar en background
    // 4. Si está offline, solo usar cache

    let cachedData: ProductSearchResponse | null = null;

    // Intentar cargar desde cache primero (rápido, síncrono)
    if (storeId) {
      try {
        const cachedProducts = await productsCacheService.getProductsFromCache(storeId, {
          search: params.q,
          category: params.category,
          is_active: params.is_active,
          limit: params.limit,
        });

        if (cachedProducts.length > 0) {
          cachedData = {
            products: cachedProducts,
            total: cachedProducts.length,
          };
        }
      } catch (error) {
        console.warn('[productsService] Error cargando desde cache:', error);
      }
    }

    // Si está offline, retornar cache inmediatamente
    if (!isOnline) {
      if (cachedData) {
        return cachedData;
      }
      throw new Error('Sin conexión y sin datos en cache local');
    }

    // Si está online, intentar actualizar desde API
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
      
      // Retornar datos frescos del API
      return response.data
    } catch (error: any) {
      // Si falla la petición, usar cache como fallback
      if (cachedData) {
        console.warn('[productsService] Error en API, usando cache local:', error.message);
        return cachedData;
      }

      // Si no hay cache y falló la petición, lanzar error
      throw error;
    }
  },

  async getById(id: string, storeId?: string): Promise<Product> {
    const isOnline = navigator.onLine;

    // ESTRATEGIA: Stale-While-Revalidate
    // 1. Intentar cargar desde cache primero
    // 2. Si está online, actualizar desde API
    // 3. Si está offline o falla, usar cache

    let cachedProduct: Product | null = null;

    // Intentar cargar desde cache primero
    if (storeId) {
      try {
        cachedProduct = await productsCacheService.getProductByIdFromCache(id);
      } catch (error) {
        console.warn('[productsService] Error cargando producto desde cache:', error);
      }
    }

    // Si está offline, retornar cache inmediatamente
    if (!isOnline) {
      if (cachedProduct) {
        return cachedProduct;
      }
      throw new Error('Sin conexión y producto no encontrado en cache local');
    }

    // Si está online, intentar actualizar desde API
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
      // Si falla y hay cache, usar cache como fallback
      if (cachedProduct) {
        console.warn('[productsService] Error en API, usando cache local:', error.message);
        return cachedProduct;
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

