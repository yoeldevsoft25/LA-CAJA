/**
 * Hook para cargar productos desde cache local
 * Se usa como initialData en React Query para persistencia offline
 */

import { useQuery } from '@tanstack/react-query'
import { productsCacheService } from '@/services/products-cache.service'
import { useAuth } from '@/stores/auth.store'
import { ProductSearchResponse } from '@/services/products.service'

/**
 * Carga productos desde IndexedDB para usar como initialData
 */
export async function loadProductsFromCache(
  storeId: string,
  options?: {
    search?: string
    category?: string
    is_active?: boolean
    limit?: number
  }
): Promise<ProductSearchResponse | undefined> {
  if (!storeId) return undefined

  try {
    const cachedProducts = await productsCacheService.getProductsFromCache(storeId, options)
    
    if (cachedProducts.length > 0) {
      return {
        products: cachedProducts,
        total: cachedProducts.length,
      }
    }
  } catch (error) {
    console.warn('[use-products-cache] Error cargando desde cache:', error)
  }

  return undefined
}

/**
 * Hook para obtener productos desde cache (para initialData)
 */
export function useProductsCache(options?: {
  search?: string
  category?: string
  is_active?: boolean
  limit?: number
}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['products', 'cache', user?.store_id, options],
    queryFn: () => loadProductsFromCache(user?.store_id || '', options),
    enabled: !!user?.store_id,
    staleTime: Infinity, // Cache nunca es stale
    gcTime: Infinity, // No eliminar del cache
  })
}







