import { api } from '@/lib/api'
import { syncService } from './sync.service'
import { exchangeService } from './exchange.service'
import { BaseEvent, SaleCreatedPayload, SaleItem as DomainSaleItem } from '@la-caja/domain'

// Función auxiliar para generar UUIDs
function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback para navegadores antiguos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface CartItemDto {
  product_id: string
  qty: number
  discount_bs?: number
  discount_usd?: number
  variant_id?: string | null
}

export interface CreateSaleRequest {
  items: CartItemDto[]
  exchange_rate: number
  currency: 'BS' | 'USD' | 'MIXED'
  payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'SPLIT' | 'FIAO'
  split?: {
    cash_bs?: number
    cash_usd?: number
    pago_movil_bs?: number
    transfer_bs?: number
    other_bs?: number
  }
  cash_payment?: {
    received_usd: number // Monto recibido en USD físico
    change_bs?: number // Cambio dado en Bs (si aplica)
  }
  cash_payment_bs?: {
    received_bs: number // Monto recibido en Bs físico
    change_bs?: number // Cambio dado en Bs (redondeado)
  }
  customer_id?: string
  customer_name?: string
  customer_document_id?: string
  customer_phone?: string
  customer_note?: string
  cash_session_id?: string
  note?: string | null
  // Para modo offline
  store_id?: string
  user_id?: string
  user_role?: 'owner' | 'cashier'
}

export interface SaleItem {
  id: string
  product_id: string
  qty: number
  unit_price_bs: number | string
  unit_price_usd: number | string
  discount_bs: number | string
  discount_usd: number | string
  product?: {
    id: string
    name: string
    sku?: string | null
    barcode?: string | null
  }
}

export interface Sale {
  id: string
  store_id: string
  cash_session_id: string | null
  customer_id: string | null
  sold_by_user_id: string | null
  sold_by_user?: {
    id: string
    full_name: string | null
  } | null
  customer?: {
    id: string
    name: string
    document_id: string | null
    phone: string | null
  } | null
  debt?: {
    id: string
    status: 'open' | 'partial' | 'paid'
    amount_bs: number | string
    amount_usd: number | string
    total_paid_bs?: number
    total_paid_usd?: number
    remaining_bs?: number
    remaining_usd?: number
  } | null
  exchange_rate: number | string
  currency: 'BS' | 'USD' | 'MIXED'
  totals: {
    subtotal_bs: number | string
    subtotal_usd: number | string
    discount_bs: number | string
    discount_usd: number | string
    total_bs: number | string
    total_usd: number | string
  }
  sold_at: string
  items: SaleItem[]
  payment: {
    method: string
    split?: {
      cash_bs?: number
      cash_usd?: number
      pago_movil_bs?: number
      transfer_bs?: number
      other_bs?: number
    }
  }
  note: string | null
}

// Función auxiliar para generar device_id
function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = randomUUID()
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

// Función auxiliar para calcular totales de la venta (no usada actualmente)
// @ts-ignore - Función no usada pero puede ser útil en el futuro
function calculateTotals(
  items: CartItemDto[],
  products: Array<{ id: string; price_bs: number; price_usd: number }>
): {
  subtotal_bs: number
  subtotal_usd: number
  discount_bs: number
  discount_usd: number
  total_bs: number
  total_usd: number
} {
  let subtotalBs = 0
  let subtotalUsd = 0
  let discountBs = 0
  let discountUsd = 0

  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id)
    if (!product) continue

    const itemSubtotalBs = product.price_bs * item.qty
    const itemSubtotalUsd = product.price_usd * item.qty
    const itemDiscountBs = item.discount_bs || 0
    const itemDiscountUsd = item.discount_usd || 0

    subtotalBs += itemSubtotalBs
    subtotalUsd += itemSubtotalUsd
    discountBs += itemDiscountBs
    discountUsd += itemDiscountUsd
  }

  return {
    subtotal_bs: subtotalBs,
    subtotal_usd: subtotalUsd,
    discount_bs: discountBs,
    discount_usd: discountUsd,
    total_bs: subtotalBs - discountBs,
    total_usd: subtotalUsd - discountUsd,
  }
}

export const salesService = {
  async create(data: CreateSaleRequest): Promise<Sale> {
    // Verificar estado de conexión PRIMERO
    const isOnline = navigator.onLine
    
    console.log('[Sales] Iniciando creación de venta:', {
      isOnline,
      hasStoreId: !!data.store_id,
      hasUserId: !!data.user_id,
      itemsCount: data.items?.length,
    })
    
    // Si está offline Y tenemos store_id/user_id, guardar como evento local inmediatamente
    // NUNCA intentar llamada HTTP si está offline
    if (!isOnline) {
      if (!data.store_id || !data.user_id) {
        throw new Error('Se requiere store_id y user_id para guardar ventas offline')
      }
      
      console.log('[Sales] ⚠️ Modo OFFLINE detectado - guardando localmente inmediatamente')
      const saleId = randomUUID()
      const deviceId = getDeviceId()
      const now = Date.now()

      // Asegurar que tenemos la tasa de cambio (usar la guardada si no viene en los datos)
      let exchangeRate = data.exchange_rate
      if (!exchangeRate || exchangeRate <= 0) {
        const cachedRate = await exchangeService.getCachedRate()
        if (cachedRate.available && cachedRate.rate) {
          exchangeRate = cachedRate.rate
        } else {
          // Si no hay tasa guardada, usar un valor por defecto (pero esto no debería pasar)
          exchangeRate = 36 // Valor por defecto
          console.warn('No se encontró tasa de cambio guardada, usando valor por defecto:', exchangeRate)
        }
      }

      // Obtener productos del cache para calcular totales y precios
      const { db } = await import('@/db/database')
      let subtotalBs = 0
      let subtotalUsd = 0
      let discountBs = 0
      let discountUsd = 0

      const saleItems: DomainSaleItem[] = []
      for (const item of data.items) {
        const product = await db.getProductById(item.product_id)
        if (!product) continue

        const unitPriceBs = product.price_bs
        const unitPriceUsd = product.price_usd
        const itemDiscountBs = item.discount_bs || 0
        const itemDiscountUsd = item.discount_usd || 0
        const itemSubtotalBs = unitPriceBs * item.qty
        const itemSubtotalUsd = unitPriceUsd * item.qty

        subtotalBs += itemSubtotalBs
        subtotalUsd += itemSubtotalUsd
        discountBs += itemDiscountBs
        discountUsd += itemDiscountUsd

        saleItems.push({
          line_id: randomUUID(),
          product_id: item.product_id,
          qty: item.qty,
          unit_price_bs: unitPriceBs,
          unit_price_usd: unitPriceUsd,
          discount_bs: itemDiscountBs,
          discount_usd: itemDiscountUsd,
        })
      }

      const totals = {
        subtotal_bs: subtotalBs,
        subtotal_usd: subtotalUsd,
        discount_bs: discountBs,
        discount_usd: discountUsd,
        total_bs: subtotalBs - discountBs,
        total_usd: subtotalUsd - discountUsd,
      }

      const payload: SaleCreatedPayload = {
        sale_id: saleId,
        cash_session_id: data.cash_session_id || '',
        sold_at: now,
        exchange_rate: data.exchange_rate,
        currency: data.currency,
        items: saleItems,
        totals,
        payment: {
          method: data.payment_method,
          split: data.split ? {
            cash_bs: data.split.cash_bs ?? 0,
            cash_usd: data.split.cash_usd ?? 0,
            pago_movil_bs: data.split.pago_movil_bs ?? 0,
            transfer_bs: data.split.transfer_bs ?? 0,
            other_bs: data.split.other_bs ?? 0,
          } : undefined,
        },
        customer: data.customer_id
          ? {
              customer_id: data.customer_id,
            }
          : undefined,
        note: data.note || undefined,
      }

      // Obtener el siguiente seq (obtener el último evento por seq, sin importar estado)
      const allEvents = await db.localEvents.orderBy('seq').reverse().limit(1).toArray()
      const nextSeq = allEvents.length > 0 ? allEvents[0].seq + 1 : 1

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: data.store_id,
        device_id: deviceId,
        seq: nextSeq,
        type: 'SaleCreated',
        version: 1,
        created_at: now,
        actor: {
          user_id: data.user_id,
          role: data.user_role || 'cashier',
        },
        payload,
      }

      // Guardar evento localmente - CRÍTICO: debe funcionar incluso si syncService falla
      try {
        await syncService.enqueueEvent(event)
        console.log('[Sales] ✅ Venta guardada localmente para sincronización:', saleId)
      } catch (error: any) {
        console.error('[Sales] ❌ Error guardando venta en syncService:', error)
        // Intentar guardar directamente en IndexedDB como fallback
        try {
          const { db } = await import('@/db/database')
          await db.localEvents.add({
            ...event,
            sync_status: 'pending',
            sync_attempts: 0,
          })
          console.log('[Sales] ✅ Venta guardada directamente en IndexedDB como fallback')
        } catch (dbError) {
          console.error('[Sales] ❌ Error guardando en IndexedDB:', dbError)
          // Aún así continuar - la venta se procesó localmente
        }
      }

      // SIEMPRE retornar la venta mock para que la UI muestre éxito
      // La venta está procesada localmente, incluso si hubo problemas guardando el evento
      const mockSale: Sale = {
        id: saleId,
        store_id: data.store_id,
        cash_session_id: data.cash_session_id || null,
        customer_id: data.customer_id || null,
        sold_by_user_id: data.user_id || null,
        sold_by_user: null,
        customer: data.customer_id
          ? {
              id: data.customer_id,
              name: data.customer_name || '',
              document_id: data.customer_document_id || null,
              phone: data.customer_phone || null,
            }
          : null,
        debt: null,
        exchange_rate: exchangeRate,
        currency: data.currency,
        totals: {
          subtotal_bs: totals.subtotal_bs.toString(),
          subtotal_usd: totals.subtotal_usd.toString(),
          discount_bs: totals.discount_bs.toString(),
          discount_usd: totals.discount_usd.toString(),
          total_bs: totals.total_bs.toString(),
          total_usd: totals.total_usd.toString(),
        },
        sold_at: new Date(now).toISOString(),
        items: saleItems.map((item) => ({
          id: item.line_id,
          product_id: item.product_id,
          qty: item.qty,
          unit_price_bs: item.unit_price_bs,
          unit_price_usd: item.unit_price_usd,
          discount_bs: item.discount_bs,
          discount_usd: item.discount_usd,
        })),
        payment: {
          method: data.payment_method,
          split: data.split ? {
            cash_bs: data.split.cash_bs ?? 0,
            cash_usd: data.split.cash_usd ?? 0,
            pago_movil_bs: data.split.pago_movil_bs ?? 0,
            transfer_bs: data.split.transfer_bs ?? 0,
            other_bs: data.split.other_bs ?? 0,
          } : undefined,
        },
        note: data.note || null,
      }

      return mockSale
    }

    // Si llegamos aquí, significa que está ONLINE
    // Intentar hacer la llamada HTTP normal
    // Si falla por error de red, guardar como evento offline
    console.log('[Sales] ✅ Modo ONLINE - intentando llamada HTTP')
    
    // Verificar nuevamente antes de intentar (puede haber cambiado)
    if (!navigator.onLine) {
      // Si se perdió la conexión mientras procesábamos, guardar offline
      console.log('[Sales] ⚠️ Conexión perdida durante el proceso, guardando offline...')
      // Reutilizar la lógica offline (código duplicado pero necesario)
      const saleId = randomUUID()
      const deviceId = getDeviceId()
      const now = Date.now()

      let exchangeRate = data.exchange_rate
      if (!exchangeRate || exchangeRate <= 0) {
        const cachedRate = await exchangeService.getCachedRate()
        if (cachedRate.available && cachedRate.rate) {
          exchangeRate = cachedRate.rate
        } else {
          exchangeRate = 36
          console.warn('No se encontró tasa de cambio guardada, usando valor por defecto:', exchangeRate)
        }
      }

      const { db } = await import('@/db/database')
      let subtotalBs = 0
      let subtotalUsd = 0
      let discountBs = 0
      let discountUsd = 0

      const saleItems: DomainSaleItem[] = []
      for (const item of data.items) {
        const product = await db.getProductById(item.product_id)
        if (!product) continue

        const unitPriceBs = product.price_bs
        const unitPriceUsd = product.price_usd
        const itemDiscountBs = item.discount_bs || 0
        const itemDiscountUsd = item.discount_usd || 0
        const itemSubtotalBs = unitPriceBs * item.qty
        const itemSubtotalUsd = unitPriceUsd * item.qty

        subtotalBs += itemSubtotalBs
        subtotalUsd += itemSubtotalUsd
        discountBs += itemDiscountBs
        discountUsd += itemDiscountUsd

        saleItems.push({
          line_id: randomUUID(),
          product_id: item.product_id,
          qty: item.qty,
          unit_price_bs: unitPriceBs,
          unit_price_usd: unitPriceUsd,
          discount_bs: itemDiscountBs,
          discount_usd: itemDiscountUsd,
        })
      }

      const totals = {
        subtotal_bs: subtotalBs,
        subtotal_usd: subtotalUsd,
        discount_bs: discountBs,
        discount_usd: discountUsd,
        total_bs: subtotalBs - discountBs,
        total_usd: subtotalUsd - discountUsd,
      }

      const payload: SaleCreatedPayload = {
        sale_id: saleId,
        cash_session_id: data.cash_session_id || '',
        sold_at: now,
        exchange_rate: exchangeRate,
        currency: data.currency,
        items: saleItems,
        totals,
        payment: {
          method: data.payment_method,
          split: data.split ? {
            cash_bs: data.split.cash_bs ?? 0,
            cash_usd: data.split.cash_usd ?? 0,
            pago_movil_bs: data.split.pago_movil_bs ?? 0,
            transfer_bs: data.split.transfer_bs ?? 0,
            other_bs: data.split.other_bs ?? 0,
          } : undefined,
        },
        customer: data.customer_id
          ? {
              customer_id: data.customer_id,
            }
          : undefined,
        note: data.note || undefined,
      }

      const allEvents = await db.localEvents.orderBy('seq').reverse().limit(1).toArray()
      const nextSeq = allEvents.length > 0 ? allEvents[0].seq + 1 : 1

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: data.store_id!, // Ya verificamos que existe arriba
        device_id: deviceId,
        seq: nextSeq,
        type: 'SaleCreated',
        version: 1,
        created_at: now,
        actor: {
          user_id: data.user_id!, // Ya verificamos que existe arriba
          role: data.user_role || 'cashier',
        },
        payload,
      }

      try {
        await syncService.enqueueEvent(event)
        console.log('[Sales] ✅ Venta guardada localmente (conexión perdida):', saleId)
      } catch (error) {
        console.error('[Sales] ❌ Error guardando venta localmente:', error)
      }

      const mockSale: Sale = {
        id: saleId,
        store_id: data.store_id!, // Ya verificamos que existe arriba
        cash_session_id: data.cash_session_id || null,
        customer_id: data.customer_id || null,
        sold_by_user_id: data.user_id || null,
        sold_by_user: null,
        customer: data.customer_id
          ? {
              id: data.customer_id,
              name: data.customer_name || '',
              document_id: data.customer_document_id || null,
              phone: data.customer_phone || null,
            }
          : null,
        debt: null,
        exchange_rate: exchangeRate,
        currency: data.currency,
        totals: {
          subtotal_bs: totals.subtotal_bs.toString(),
          subtotal_usd: totals.subtotal_usd.toString(),
          discount_bs: totals.discount_bs.toString(),
          discount_usd: totals.discount_usd.toString(),
          total_bs: totals.total_bs.toString(),
          total_usd: totals.total_usd.toString(),
        },
        sold_at: new Date(now).toISOString(),
        items: saleItems.map((item) => ({
          id: item.line_id,
          product_id: item.product_id,
          qty: item.qty,
          unit_price_bs: item.unit_price_bs,
          unit_price_usd: item.unit_price_usd,
          discount_bs: item.discount_bs,
          discount_usd: item.discount_usd,
        })),
        payment: {
          method: data.payment_method,
          split: data.split ? {
            cash_bs: data.split.cash_bs ?? 0,
            cash_usd: data.split.cash_usd ?? 0,
            pago_movil_bs: data.split.pago_movil_bs ?? 0,
            transfer_bs: data.split.transfer_bs ?? 0,
            other_bs: data.split.other_bs ?? 0,
          } : undefined,
        },
        note: data.note || null,
      }

      return mockSale
    }

    try {
      console.log('📤 [Frontend] Sending sale data (before cleaning):', {
        cash_session_id: data.cash_session_id,
        cash_session_id_type: typeof data.cash_session_id,
        payment_method: data.payment_method,
        items_count: data.items?.length,
      })

      // Filtrar campos undefined y cadenas vacías, pero mantener null explícitos
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(
          ([key, value]) =>
            !['store_id', 'user_id', 'user_role'].includes(key) &&
            value !== undefined &&
            value !== ''
        )
      ) as CreateSaleRequest

      console.log('📤 [Frontend] Sending sale data (after cleaning):', {
        cash_session_id: cleanedData.cash_session_id,
        cash_session_id_type: typeof cleanedData.cash_session_id,
        hasCashSessionId: 'cash_session_id' in cleanedData,
        keys: Object.keys(cleanedData),
      })

      // Agregar timeout de 5 segundos para evitar que se quede colgada
      // El interceptor de axios ya rechaza si está offline, así que esto solo se ejecuta si está online
      console.log('[Sales] ⏳ Iniciando llamada HTTP con timeout de 5 segundos...')
      
      const response = await Promise.race([
        api.post<Sale>('/sales', cleanedData).then((res) => {
          console.log('[Sales] ✅ Respuesta HTTP recibida exitosamente')
          return res
        }).catch((err) => {
          console.log('[Sales] ❌ Error en llamada HTTP:', err)
          throw err
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            console.log('[Sales] ⏰ TIMEOUT después de 5 segundos')
            reject(new Error('TIMEOUT'))
          }, 5000)
        }),
      ])
      
      console.log('[Sales] ✅ Venta procesada exitosamente:', response.data?.id)
      return response.data
    } catch (error: any) {
      // Si falla por error de red, timeout, o error offline y tenemos los datos necesarios, guardar offline
      // El interceptor de axios rechaza con ERR_INTERNET_DISCONNECTED si está offline
      const isNetworkError =
        !error.response || 
        error.code === 'ECONNABORTED' || 
        error.code === 'ERR_NETWORK' ||
        error.code === 'ERR_INTERNET_DISCONNECTED' ||
        error.isOffline ||
        error.message === 'TIMEOUT' ||
        !navigator.onLine
      
      console.log('[Sales] ❌ Error capturado en catch:', {
        code: error.code,
        isOffline: error.isOffline,
        message: error.message,
        navigatorOnLine: navigator.onLine,
        isNetworkError,
        hasStoreId: !!data.store_id,
        hasUserId: !!data.user_id,
        error: error,
      })
      
      // Si no es un error de red o no tenemos los datos necesarios, lanzar el error
      if (!isNetworkError || !data.store_id || !data.user_id) {
        console.error('[Sales] ❌ Error no manejable o faltan datos:', error)
        throw error
      }
      
      console.log('[Sales] ⚠️ Error de red detectado - guardando offline como fallback')

      if (isNetworkError && data.store_id && data.user_id) {
        // Reutilizar la lógica offline
        const saleId = randomUUID()
        const deviceId = getDeviceId()
        const now = Date.now()

        // Asegurar que tenemos la tasa de cambio (usar la guardada si no viene en los datos)
        let exchangeRate = data.exchange_rate
        if (!exchangeRate || exchangeRate <= 0) {
          const cachedRate = await exchangeService.getCachedRate()
          if (cachedRate.available && cachedRate.rate) {
            exchangeRate = cachedRate.rate
          } else {
            // Si no hay tasa guardada, usar un valor por defecto (pero esto no debería pasar)
            exchangeRate = 36 // Valor por defecto
            console.warn('No se encontró tasa de cambio guardada, usando valor por defecto:', exchangeRate)
          }
        }

        // Obtener productos del cache para calcular totales y precios
        const { db } = await import('@/db/database')
        let subtotalBs = 0
        let subtotalUsd = 0
        let discountBs = 0
        let discountUsd = 0

        const saleItems: DomainSaleItem[] = []
        for (const item of data.items) {
          const product = await db.getProductById(item.product_id)
          if (!product) continue

          const unitPriceBs = product.price_bs
          const unitPriceUsd = product.price_usd
          const itemDiscountBs = item.discount_bs || 0
          const itemDiscountUsd = item.discount_usd || 0
          const itemSubtotalBs = unitPriceBs * item.qty
          const itemSubtotalUsd = unitPriceUsd * item.qty

          subtotalBs += itemSubtotalBs
          subtotalUsd += itemSubtotalUsd
          discountBs += itemDiscountBs
          discountUsd += itemDiscountUsd

          saleItems.push({
            line_id: randomUUID(),
            product_id: item.product_id,
            qty: item.qty,
            unit_price_bs: unitPriceBs,
            unit_price_usd: unitPriceUsd,
            discount_bs: itemDiscountBs,
            discount_usd: itemDiscountUsd,
          })
        }

        const totals = {
          subtotal_bs: subtotalBs,
          subtotal_usd: subtotalUsd,
          discount_bs: discountBs,
          discount_usd: discountUsd,
          total_bs: subtotalBs - discountBs,
          total_usd: subtotalUsd - discountUsd,
        }

        const payload: SaleCreatedPayload = {
          sale_id: saleId,
          cash_session_id: data.cash_session_id || '',
          sold_at: now,
          exchange_rate: exchangeRate,
          currency: data.currency,
          items: saleItems,
          totals,
        payment: {
          method: data.payment_method,
          split: data.split ? {
            cash_bs: data.split.cash_bs ?? 0,
            cash_usd: data.split.cash_usd ?? 0,
            pago_movil_bs: data.split.pago_movil_bs ?? 0,
            transfer_bs: data.split.transfer_bs ?? 0,
            other_bs: data.split.other_bs ?? 0,
          } : undefined,
        },
        customer: data.customer_id
            ? {
                customer_id: data.customer_id,
              }
            : undefined,
          note: data.note || undefined,
        }

        // Obtener el siguiente seq
        const allEvents = await db.localEvents.orderBy('seq').reverse().limit(1).toArray()
        const nextSeq = allEvents.length > 0 ? allEvents[0].seq + 1 : 1

        const event: BaseEvent = {
          event_id: randomUUID(),
          store_id: data.store_id,
          device_id: deviceId,
          seq: nextSeq,
          type: 'SaleCreated',
          version: 1,
          created_at: now,
          actor: {
            user_id: data.user_id,
            role: data.user_role || 'cashier',
          },
          payload,
        }

        // Guardar evento localmente
        try {
        await syncService.enqueueEvent(event)
          console.log('[Sales] ✅ Venta guardada localmente después de error de red:', saleId)
        } catch (error) {
          console.error('[Sales] ❌ Error guardando venta localmente después de error de red:', error)
          // Aún así retornar la venta mock para que la UI muestre éxito
        }

        // Retornar una venta "mock"
        const mockSale: Sale = {
          id: saleId,
          store_id: data.store_id,
          cash_session_id: data.cash_session_id || null,
          customer_id: data.customer_id || null,
          sold_by_user_id: data.user_id || null,
          sold_by_user: null,
          customer: data.customer_id
            ? {
                id: data.customer_id,
                name: data.customer_name || '',
                document_id: data.customer_document_id || null,
                phone: data.customer_phone || null,
              }
            : null,
          debt: null,
          exchange_rate: exchangeRate,
          currency: data.currency,
          totals: {
            subtotal_bs: totals.subtotal_bs.toString(),
            subtotal_usd: totals.subtotal_usd.toString(),
            discount_bs: totals.discount_bs.toString(),
            discount_usd: totals.discount_usd.toString(),
            total_bs: totals.total_bs.toString(),
            total_usd: totals.total_usd.toString(),
          },
          sold_at: new Date(now).toISOString(),
          items: saleItems.map((item) => ({
            id: item.line_id,
            product_id: item.product_id,
            qty: item.qty,
            unit_price_bs: item.unit_price_bs,
            unit_price_usd: item.unit_price_usd,
            discount_bs: item.discount_bs,
            discount_usd: item.discount_usd,
          })),
        payment: {
          method: data.payment_method,
          split: data.split ? {
            cash_bs: data.split.cash_bs ?? 0,
            cash_usd: data.split.cash_usd ?? 0,
            pago_movil_bs: data.split.pago_movil_bs ?? 0,
            transfer_bs: data.split.transfer_bs ?? 0,
            other_bs: data.split.other_bs ?? 0,
          } : undefined,
        },
        note: data.note || null,
        }

        return mockSale
      }

      // Si no es error de red o no tenemos los datos necesarios, lanzar el error
      throw error
    }
  },

  async getById(id: string): Promise<Sale> {
    const response = await api.get<Sale>(`/sales/${id}`)
    return response.data
  },

  async list(params?: {
    date_from?: string
    date_to?: string
    limit?: number
    offset?: number
    store_id?: string
  }): Promise<{ sales: Sale[]; total: number }> {
    const response = await api.get<{ sales: Sale[]; total: number }>('/sales', { params })
    return response.data
  },
}
