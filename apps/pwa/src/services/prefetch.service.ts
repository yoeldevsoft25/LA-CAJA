/**
 * Servicio de Prefetch Inteligente
 * Cachea todos los datos críticos después del login para máximo rendimiento offline
 */

import { QueryClient } from '@tanstack/react-query'
import { productsService, ProductSearchResponse } from './products.service'
import { customersService } from './customers.service'
import { cashService } from './cash.service'
import { exchangeService } from './exchange.service'
import { salesService } from './sales.service'
import { debtsService } from './debts.service'
import { inventoryService } from './inventory.service'
import { reportsService } from './reports.service'
import { productsCacheService } from './products-cache.service'

interface PrefetchOptions {
  storeId: string
  queryClient: QueryClient
  onProgress?: (progress: number, message: string) => void
}

/**
 * Prefetch inteligente de todos los datos críticos
 * Se ejecuta después del login para cachear todo en background
 */
export async function prefetchAllData({ storeId, queryClient, onProgress }: PrefetchOptions): Promise<void> {
  if (!storeId) return

  const totalSteps = 8
  let currentStep = 0

  const updateProgress = (message: string) => {
    currentStep++
    const progress = Math.round((currentStep / totalSteps) * 100)
    onProgress?.(progress, message)
  }

  try {
    // 0. PRIORIDAD MÁXIMA: Prefetch tasa BCV PRIMERO (crítico para todos los cálculos)
    updateProgress('Cacheando tasa de cambio BCV...')
    await queryClient.prefetchQuery({
      queryKey: ['exchange', 'bcv'],
      queryFn: () => exchangeService.getBCVRate(),
      staleTime: 1000 * 60 * 60 * 2, // 2 horas - la tasa cambia poco pero es crítica
      gcTime: Infinity, // NUNCA eliminar del cache
    })

    // 1. Prefetch productos activos (más crítico - se usa en POS)
    updateProgress('Cacheando productos...')
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['products', 'search', '', storeId],
        queryFn: () => productsService.search({ is_active: true, limit: 500 }, storeId),
        staleTime: 1000 * 60 * 30, // 30 minutos
        gcTime: Infinity, // Nunca eliminar
      }),
      // También cachear en IndexedDB
      productsService.search({ is_active: true, limit: 500 }, storeId).then((data) => {
        if (data.products) {
          return productsCacheService.cacheProducts(storeId, data.products)
        }
      }).catch(() => {
        // Silenciar errores
      }),
    ])

    // 2. Prefetch clientes (usado en ventas y deudas)
    updateProgress('Cacheando clientes...')
    await queryClient.prefetchQuery({
      queryKey: ['customers', storeId],
      queryFn: () => customersService.getAll(storeId),
      staleTime: 1000 * 60 * 30,
      gcTime: Infinity,
    })

    // 3. Prefetch sesión de caja actual
    updateProgress('Cacheando sesión de caja...')
    await queryClient.prefetchQuery({
      queryKey: ['cash', 'current-session'],
      queryFn: () => cashService.getCurrentSession(),
      staleTime: 1000 * 60 * 5,
      gcTime: Infinity,
    })

    // 4. Tasa BCV ya fue cacheada al inicio (prioridad máxima)

    // 5. Prefetch ventas recientes (últimas 50)
    updateProgress('Cacheando ventas recientes...')
    await queryClient.prefetchQuery({
      queryKey: ['sales', 'list', storeId, { limit: 50 }],
      queryFn: () => salesService.getSales({ limit: 50 }, storeId),
      staleTime: 1000 * 60 * 10,
      gcTime: Infinity,
    })

    // 6. Prefetch deudas activas
    updateProgress('Cacheando deudas...')
    await queryClient.prefetchQuery({
      queryKey: ['debts', 'list', storeId],
      queryFn: () => debtsService.getAll(storeId),
      staleTime: 1000 * 60 * 15,
      gcTime: Infinity,
    })

    // 7. Prefetch estado de inventario (productos con stock bajo)
    updateProgress('Cacheando inventario...')
    await queryClient.prefetchQuery({
      queryKey: ['inventory', 'status', storeId],
      queryFn: () => inventoryService.getLowStock(),
      staleTime: 1000 * 60 * 10,
      gcTime: Infinity,
    })

    // 8. Prefetch sesiones de caja recientes
    updateProgress('Cacheando sesiones de caja...')
    await queryClient.prefetchQuery({
      queryKey: ['cash', 'sessions', storeId],
      queryFn: () => cashService.getSessions({ limit: 20 }, storeId),
      staleTime: 1000 * 60 * 10,
      gcTime: Infinity,
    })

    updateProgress('¡Cacheo completo!')
  } catch (error) {
    console.warn('[Prefetch] Error durante prefetch:', error)
    // No lanzar error - el prefetch es opcional
  }
}

/**
 * Prefetch de datos específicos de una página
 * Se ejecuta cuando el usuario navega a una página
 */
export async function prefetchPageData(
  page: 'pos' | 'products' | 'inventory' | 'sales' | 'cash' | 'customers' | 'debts' | 'reports',
  storeId: string,
  queryClient: QueryClient
): Promise<void> {
  if (!storeId) return

  try {
    switch (page) {
      case 'pos':
        // POS ya tiene prefetch completo, solo asegurar productos
        await queryClient.prefetchQuery({
          queryKey: ['products', 'search', '', storeId],
          queryFn: () => productsService.search({ is_active: true, limit: 500 }, storeId),
          staleTime: 1000 * 60 * 30,
        })
        break

      case 'products':
        await queryClient.prefetchQuery({
          queryKey: ['products', 'list', '', storeId],
          queryFn: () => productsService.search({ limit: 100 }, storeId),
          staleTime: 1000 * 60 * 30,
        })
        break

      case 'inventory':
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['products', 'list', '', storeId],
            queryFn: () => productsService.search({ limit: 200 }, storeId),
            staleTime: 1000 * 60 * 30,
          }),
          queryClient.prefetchQuery({
            queryKey: ['inventory', 'status', storeId],
            queryFn: () => inventoryService.getLowStock(),
            staleTime: 1000 * 60 * 10,
          }),
        ])
        break

      case 'sales':
        await queryClient.prefetchQuery({
          queryKey: ['sales', 'list', storeId],
          queryFn: () => salesService.getSales({ limit: 100 }, storeId),
          staleTime: 1000 * 60 * 10,
        })
        break

      case 'cash':
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['cash', 'current-session'],
            queryFn: () => cashService.getCurrentSession(),
            staleTime: 1000 * 60 * 5,
          }),
          queryClient.prefetchQuery({
            queryKey: ['cash', 'sessions', storeId],
            queryFn: () => cashService.getSessions({ limit: 20 }, storeId),
            staleTime: 1000 * 60 * 10,
          }),
        ])
        break

      case 'customers':
        await queryClient.prefetchQuery({
          queryKey: ['customers', storeId],
          queryFn: () => customersService.getAll(storeId),
          staleTime: 1000 * 60 * 30,
        })
        break

      case 'debts':
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['debts', 'list', storeId],
            queryFn: () => debtsService.getAll(storeId),
            staleTime: 1000 * 60 * 15,
          }),
          queryClient.prefetchQuery({
            queryKey: ['customers', storeId],
            queryFn: () => customersService.getAll(storeId),
            staleTime: 1000 * 60 * 30,
          }),
        ])
        break

      case 'reports':
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['exchange', 'bcv'],
            queryFn: () => exchangeService.getBCVRate(),
            staleTime: 1000 * 60 * 60 * 2, // 2 horas
            gcTime: Infinity, // Nunca eliminar
          }),
          queryClient.prefetchQuery({
            queryKey: ['reports', 'sales-by-day', storeId],
            queryFn: () => reportsService.getSalesByDay(),
            staleTime: 1000 * 60 * 10,
          }),
          queryClient.prefetchQuery({
            queryKey: ['reports', 'top-products', storeId],
            queryFn: () => reportsService.getTopProducts(10),
            staleTime: 1000 * 60 * 10,
          }),
        ])
        break
    }
  } catch (error) {
    console.warn(`[Prefetch] Error prefetching ${page}:`, error)
  }
}

