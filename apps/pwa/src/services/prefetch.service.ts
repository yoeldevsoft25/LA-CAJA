/**
 * Servicio de Prefetch Inteligente
 * Cachea todos los datos críticos después del login para máximo rendimiento offline
 */

import { QueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { productsService } from './products.service'
import { customersService } from './customers.service'
import { cashService } from './cash.service'
import { exchangeService } from './exchange.service'
import { salesService } from './sales.service'
import { debtsService } from './debts.service'
import { inventoryService } from './inventory.service'
import { reportsService } from './reports.service'
import { productsCacheService } from './products-cache.service'
import { createLogger } from '@/lib/logger'
import { api } from '@/lib/api'
import { db } from '@/db/database'

const logger = createLogger('Prefetch')

interface PrefetchOptions {
  storeId: string
  queryClient: QueryClient
  userRole?: 'owner' | 'cashier'
  onProgress?: (progress: number, message: string) => void
}

/**
 * Prefetch inteligente de todos los datos críticos
 * Se ejecuta después del login para cachear todo en background
 */
export async function prefetchAllData({ storeId, queryClient, userRole, onProgress }: PrefetchOptions): Promise<void> {
  if (!storeId) return

  const isOwner = userRole === 'owner'
  const totalSteps = isOwner ? 9 : 8 // Reportes solo para owners
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
        if (data.products && data.products.length > 0) {
          return productsCacheService.cacheProducts(data.products, storeId)
        }
      }).catch(() => {
        // Silenciar errores
      }),
    ])

    // 2. Prefetch clientes (usado en ventas y deudas)
    updateProgress('Cacheando clientes...')
    const customersData = await customersService.search('') // Obtener todos los clientes

    // Establecer en múltiples queryKeys para que todos los componentes lo encuentren
    queryClient.setQueryData(['customers', ''], customersData) // Para CustomersPage
    queryClient.setQueryData(['customers'], customersData) // Para DebtsPage

    // También prefetch para mantener consistencia
    await queryClient.prefetchQuery({
      queryKey: ['customers', ''],
      queryFn: () => Promise.resolve(customersData),
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
    // NOTA: No enviar store_id - el backend usará el del JWT del usuario
    updateProgress('Cacheando ventas recientes...')
    const salesData = await salesService.list({ limit: 50 })

    // Establecer en la queryKey que usa el prefetch
    queryClient.setQueryData(['sales', 'list', storeId, { limit: 50 }], salesData)

    // También prefetch para mantener consistencia
    await queryClient.prefetchQuery({
      queryKey: ['sales', 'list', storeId, { limit: 50 }],
      queryFn: () => Promise.resolve(salesData),
      staleTime: 1000 * 60 * 10,
      gcTime: Infinity,
    })

    // 6. Prefetch deudas activas
    updateProgress('Cacheando deudas...')
    const debtsData = await debtsService.findAll() // Obtener todas las deudas

    // Establecer en la queryKey que usa DebtsPage
    queryClient.setQueryData(['debts', undefined], debtsData) // Para DebtsPage cuando statusFilter es 'all'

    // También prefetch para mantener consistencia
    await queryClient.prefetchQuery({
      queryKey: ['debts', undefined],
      queryFn: () => Promise.resolve(debtsData),
      staleTime: 1000 * 60 * 15,
      gcTime: Infinity,
    })

    // 7. Prefetch estado de inventario (Stock y Escrows)
    updateProgress('Cacheando inventario y cuotas...')
    const stockStatusData = await inventoryService.getStockStatus({ limit: 500 })

    // Establecer en la queryKey del prefetch (vía legacy endpoint si se usa)
    queryClient.setQueryData(['inventory', 'status', storeId], stockStatusData)

    // ✅ OFFLINE-FIRST: Cachear en IndexedDB para validación local
    await Promise.all([
      inventoryService.cacheStock(stockStatusData).catch(err => logger.error('Error cacheando stock', err)),
      inventoryService.getEscrowStatus(storeId)
        .then(escrows => inventoryService.cacheEscrows(escrows))
        .catch(err => logger.error('Error cacheando escrows', err))
    ]);

    await queryClient.prefetchQuery({
      queryKey: ['inventory', 'status', storeId],
      queryFn: () => Promise.resolve(stockStatusData),
      staleTime: 1000 * 60 * 10,
      gcTime: Infinity,
    })

    // 8. Prefetch sesiones de caja recientes
    updateProgress('Cacheando sesiones de caja...')
    const sessionsData = await cashService.listSessions({ limit: 20 })

    // Establecer en la queryKey del prefetch
    queryClient.setQueryData(['cash', 'sessions', storeId], sessionsData)

    // También establecer en la queryKey que usa CashSessionsList (primera página)
    queryClient.setQueryData(['cash', 'sessions', 1], sessionsData)

    // También prefetch para mantener consistencia
    await queryClient.prefetchQuery({
      queryKey: ['cash', 'sessions', storeId],
      queryFn: () => Promise.resolve(sessionsData),
      staleTime: 1000 * 60 * 10,
      gcTime: Infinity,
    })

    // 9. Prefetch hashes de PIN para autenticación offline
    updateProgress('Cacheando credenciales offline...')
    try {
      const offlineHashes = await api.get<Array<{ user_id: string; pin_hash: string; role: string }>>(
        `/auth/stores/${storeId}/offline-members`
      )
      if (offlineHashes.data) {
        await db.kv.put({
          key: `offline_creds:${storeId}`,
          value: offlineHashes.data,
        })
        logger.debug('Credenciales offline guardadas', { count: offlineHashes.data.length })
      }
    } catch (error) {
      logger.warn('Error cacheando credenciales offline', { error })
    }

    // 10. Prefetch reportes (hoy) - SOLO para owners
    if (isOwner) {
      updateProgress('Cacheando reportes...')
      const today = format(new Date(), 'yyyy-MM-dd')
      try {
        const [salesReport, topProducts, debtSummary] = await Promise.all([
          reportsService.getSalesByDay({ start_date: today, end_date: today }).catch(() => null),
          reportsService.getTopProducts(10, { start_date: today, end_date: today }).catch(() => null),
          reportsService.getDebtSummary().catch(() => null),
        ])

        // Establecer en las queryKeys que usa ReportsPage
        if (salesReport) {
          queryClient.setQueryData(['reports', 'sales-by-day', today, today], salesReport)
        }
        if (topProducts) {
          queryClient.setQueryData(['reports', 'top-products', today, today], topProducts)
        }
        if (debtSummary) {
          queryClient.setQueryData(['reports', 'debt-summary'], debtSummary)
        }
      } catch (error) {
        // Silenciar errores de reportes - no son críticos
        logger.warn('Error cacheando reportes', { error })
      }
    }

    updateProgress('¡Cacheo completo!')
  } catch (error) {
    logger.warn('Error durante prefetch', { error })
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
  queryClient: QueryClient,
  userRole?: 'owner' | 'cashier'
): Promise<void> {
  if (!storeId) return

  const isOwner = userRole === 'owner'

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
        // NOTA: No enviar store_id - el backend usará el del JWT del usuario
        await queryClient.prefetchQuery({
          queryKey: ['sales', 'list', storeId],
          queryFn: () => salesService.list({ limit: 100 }),
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
            queryFn: () => cashService.listSessions({ limit: 20 }),
            staleTime: 1000 * 60 * 10,
          }),
        ])
        break

      case 'customers':
        await queryClient.prefetchQuery({
          queryKey: ['customers', storeId],
          queryFn: () => customersService.search(''), // Obtener todos los clientes
          staleTime: 1000 * 60 * 30,
        })
        break

      case 'debts':
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['debts', 'list', storeId],
            queryFn: () => debtsService.findAll(), // Obtener todas las deudas
            staleTime: 1000 * 60 * 15,
          }),
          queryClient.prefetchQuery({
            queryKey: ['customers', storeId],
            queryFn: () => customersService.search(''), // Obtener todos los clientes
            staleTime: 1000 * 60 * 30,
          }),
        ])
        break

      case 'reports':
        // Solo prefetch de reportes si el usuario es owner
        if (!isOwner) {
          break
        }
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
    logger.warn('Error prefetching page', { error, page })
  }
}

