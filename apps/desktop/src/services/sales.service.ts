import { api } from '@/lib/api'
import type { AxiosResponse } from 'axios'
import { syncService } from './sync.service'
import { exchangeService } from './exchange.service'
import { connectivityService } from './connectivity.service'
import { BaseEvent, SaleCreatedPayload, SaleItem as DomainSaleItem, PricingCalculator, WeightUnit } from '@la-caja/domain'
import { createLogger } from '@/lib/logger'
import { db } from '@/db/database'
import { productRepository } from '@/db/repositories'
import type { Product } from './products.service'

const logger = createLogger('SalesService')

function isApplicationOnline(): boolean {
  return navigator.onLine && connectivityService.online
}

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
  is_weight_product?: boolean
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null
  weight_value?: number | null
  price_per_weight_bs?: number | null
  price_per_weight_usd?: number | null
}

// Pago individual en sistema de pagos divididos
export interface SplitPaymentDto {
  method: string
  amount_usd?: number
  amount_bs?: number
  reference?: string
  bank_code?: string
  phone?: string
  card_last_4?: string
  note?: string
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
  split_payments?: SplitPaymentDto[] // Pagos divididos (sistema multi-tasa)
  cash_payment?: {
    received_usd: number // Monto recibido en USD físico
    change_bs?: number // Cambio dado en Bs (si aplica)
    change_rounding?: {
      mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT'
      exact_change_bs: number
      rounded_change_bs: number
      adjustment_bs: number
      consented?: boolean
    }
  }
  cash_payment_bs?: {
    received_bs: number // Monto recibido en Bs físico
    change_bs?: number // Cambio dado en Bs (redondeado)
    change_rounding?: {
      mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT'
      exact_change_bs: number
      rounded_change_bs: number
      adjustment_bs: number
      consented?: boolean
    }
  }
  customer_id?: string
  customer_name?: string
  customer_document_id?: string
  customer_phone?: string
  customer_note?: string
  cash_session_id?: string
  note?: string | null
  invoice_series_id?: string | null // ID de la serie de factura a usar
  price_list_id?: string | null // ID de la lista de precio a usar
  promotion_id?: string | null // ID de la promoción a aplicar
  warehouse_id?: string | null // ID de la bodega de donde se vende (opcional, usa bodega por defecto)
  generate_fiscal_invoice?: boolean // Si se debe generar factura fiscal
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
  is_weight_product?: boolean
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null
  weight_value?: number | null
  price_per_weight_bs?: number | null
  price_per_weight_usd?: number | null
  product?: {
    id: string
    name: string
    sku?: string | null
    barcode?: string | null
  }
}

function resolveOfflineItemPricing(
  product: Product,
  item: CartItemDto,
): {
  qty: number
  unit_price_bs: number
  unit_price_usd: number
  discount_bs: number
  discount_usd: number
  subtotal_bs: number
  subtotal_usd: number
  is_weight_product: boolean
  weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null
  weight_value: number | null
  price_per_weight_bs: number | null
  price_per_weight_usd: number | null
} {
  const isWeightProduct = Boolean(item.is_weight_product || product.is_weight_product)
  const itemDiscountBs = item.discount_bs || 0
  const itemDiscountUsd = item.discount_usd || 0

  // ⚡ FIX: Convertir precios a números (PostgreSQL devuelve NUMERIC como string)
  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    return typeof value === 'string' ? parseFloat(value) || 0 : value;
  };

  if (isWeightProduct) {
    const weightValue = item.weight_value || item.qty || 0
    const pricePerWeightBs = toNumber(item.price_per_weight_bs ?? product.price_per_weight_bs ?? 0)
    const pricePerWeightUsd = toNumber(item.price_per_weight_usd ?? product.price_per_weight_usd ?? 0)

    const totals = PricingCalculator.calculateItemTotals({
      qty: weightValue,
      unitPriceBs: 0, // No aplica para producto por peso
      unitPriceUsd: 0, // No aplica
      discountBs: itemDiscountBs,
      discountUsd: itemDiscountUsd,
      isWeightProduct: true,
      weightUnit: (item.weight_unit || product.weight_unit || 'kg') as WeightUnit,
      weightValue: weightValue,
      pricePerWeightBs: pricePerWeightBs,
      pricePerWeightUsd: pricePerWeightUsd,
    });

    return {
      qty: totals.qty,
      unit_price_bs: totals.effectivePriceBs,
      unit_price_usd: totals.effectivePriceUsd,
      discount_bs: totals.discountBs,
      discount_usd: totals.discountUsd,
      subtotal_bs: totals.subtotalBs,
      subtotal_usd: totals.subtotalUsd,
      is_weight_product: true,
      weight_unit: (item.weight_unit || product.weight_unit || null) as any,
      weight_value: weightValue,
      price_per_weight_bs: pricePerWeightBs || null,
      price_per_weight_usd: pricePerWeightUsd || null,
    }
  }

  const unitPriceBs = toNumber(product.price_bs)
  const unitPriceUsd = toNumber(product.price_usd)

  const totals = PricingCalculator.calculateItemTotals({
    qty: item.qty,
    unitPriceBs: unitPriceBs,
    unitPriceUsd: unitPriceUsd,
    discountBs: itemDiscountBs,
    discountUsd: itemDiscountUsd,
    isWeightProduct: false,
  });

  return {
    qty: totals.qty,
    unit_price_bs: totals.effectivePriceBs,
    unit_price_usd: totals.effectivePriceUsd,
    discount_bs: totals.discountBs,
    discount_usd: totals.discountUsd,
    subtotal_bs: totals.subtotalBs,
    subtotal_usd: totals.subtotalUsd,
    is_weight_product: false,
    weight_unit: null,
    weight_value: null,
    price_per_weight_bs: null,
    price_per_weight_usd: null,
  }
}

export interface Sale {
  id: string
  store_id: string
  cash_session_id: string | null
  customer_id: string | null
  sold_by_user_id: string | null
  voided_at?: string | null
  voided_by_user_id?: string | null
  void_reason?: string | null
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
  sync_status?: 'pending' | 'synced' | 'failed' | 'conflict'
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
    split_payments?: SplitPaymentDto[]
    cash_payment?: {
      received_usd: number
      change_bs?: number
    }
    cash_payment_bs?: {
      received_bs: number
      change_bs?: number
    }
  }
  note: string | null
  invoice_series_id?: string | null
  invoice_number?: string | null
  invoice_full_number?: string | null
  fiscal_invoice?: {
    id: string
    invoice_number: string
    fiscal_number?: string | null
    status: 'draft' | 'issued' | 'cancelled' | 'rejected'
    issued_at?: string | null
  } | null
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

/**
 * Servicio para gestión de ventas con soporte offline-first
 * 
 * @remarks
 * Este servicio maneja la creación de ventas tanto en modo online como offline.
 * En modo offline, las ventas se guardan localmente y se sincronizan cuando hay conexión.
 * 
 * @example
 * ```typescript
 * const sale = await salesService.create({
 *   items: [{ product_id: '123', qty: 2 }],
 *   exchange_rate: 36,
 *   currency: 'USD',
 *   payment_method: 'CASH_USD',
 *   store_id: 'store-123',
 *   user_id: 'user-456'
 * });
 * ```
 */
export const salesService = {
  /**
   * Crea una nueva venta
   * 
   * @param data - Datos de la venta a crear
   * @returns Promise que resuelve con la venta creada
   * @throws Error si falta store_id o user_id en modo offline
   * @throws Error si la venta FIAO no tiene cliente asociado
   * 
   * @remarks
   * - En modo offline, guarda la venta localmente inmediatamente
   * - En modo online, intenta enviar al servidor primero
   * - Si falla la conexión, guarda offline como fallback
   */
  async create(
    data: CreateSaleRequest,
    options?: { returnMode?: 'full' | 'minimal' },
  ): Promise<Sale> {
    // Verificar estado de conexión PRIMERO
    const isOnline = isApplicationOnline()

    logger.debug('Iniciando creación de venta', {
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

      // ⚠️ VALIDACIÓN CRÍTICA: Ventas FIAO requieren cliente
      if (data.payment_method === 'FIAO') {
        const hasCustomerId = !!data.customer_id
        const hasCustomerData = !!(data.customer_name && data.customer_document_id)

        if (!hasCustomerId && !hasCustomerData) {
          throw new Error('Las ventas FIAO requieren un cliente. Debes seleccionar un cliente existente o ingresar nombre y cédula para crear uno nuevo.')
        }
      }

      logger.info('Modo OFFLINE detectado - guardando localmente inmediatamente')
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
          logger.warn('No se encontró tasa de cambio guardada, usando valor por defecto', { exchangeRate })
        }
      }

      // Obtener productos del cache para calcular totales y precios
      let subtotalBs = 0
      let subtotalUsd = 0
      let discountBs = 0
      let discountUsd = 0

      const saleItems: DomainSaleItem[] = []
      for (const item of data.items) {
        const localProduct = await db.getProductById(item.product_id)
        if (!localProduct) continue

        // ⚡ FIX: Convertir LocalProduct a Product (updated_at: number -> string)
        const product: Product = {
          ...localProduct,
          updated_at: new Date(localProduct.updated_at).toISOString(),
        };

        const resolved = resolveOfflineItemPricing(product, item)

        subtotalBs += resolved.subtotal_bs
        subtotalUsd += resolved.subtotal_usd
        discountBs += resolved.discount_bs
        discountUsd += resolved.discount_usd

        saleItems.push({
          line_id: randomUUID(),
          product_id: item.product_id,
          qty: resolved.qty,
          unit_price_bs: resolved.unit_price_bs,
          unit_price_usd: resolved.unit_price_usd,
          discount_bs: resolved.discount_bs,
          discount_usd: resolved.discount_usd,
          is_weight_product: resolved.is_weight_product,
          weight_unit: resolved.weight_unit,
          weight_value: resolved.weight_value,
          price_per_weight_bs: resolved.price_per_weight_bs,
          price_per_weight_usd: resolved.price_per_weight_usd,
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

      const requestId = randomUUID()
      const payload: SaleCreatedPayload = {
        sale_id: saleId,
        request_id: requestId,
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
        logger.info('Venta guardada localmente para sincronización', { saleId })
      } catch (error: unknown) {
        logger.error('Error guardando venta en syncService', error)
        // Intentar guardar directamente en IndexedDB como fallback
        try {
          await db.localEvents.add({
            ...event,
            sync_status: 'pending',
            sync_attempts: 0,
          })
          logger.info('Venta guardada directamente en IndexedDB como fallback', { saleId })
        } catch (dbError) {
          logger.error('Error guardando en IndexedDB', dbError)
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
          is_weight_product: item.is_weight_product,
          weight_unit: item.weight_unit,
          weight_value: item.weight_value,
          price_per_weight_bs: item.price_per_weight_bs,
          price_per_weight_usd: item.price_per_weight_usd,
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
    logger.info('Modo ONLINE - intentando llamada HTTP')

    // Verificar nuevamente antes de intentar (puede haber cambiado)
    if (!isApplicationOnline()) {
      // Si se perdió la conexión mientras procesábamos, guardar offline
      logger.warn('Conexión perdida durante el proceso, guardando offline')
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
          logger.warn('No se encontró tasa de cambio guardada, usando valor por defecto', { exchangeRate })
        }
      }

      let subtotalBs = 0
      let subtotalUsd = 0
      let discountBs = 0
      let discountUsd = 0

      const saleItems: DomainSaleItem[] = []
      for (const item of data.items) {
        const localProduct = await productRepository.findById(item.product_id)
        if (!localProduct) continue

        // ⚡ FIX: Convertir LocalProduct a Product (updated_at: number -> string)
        const product: Product = {
          ...localProduct,
          updated_at: new Date(localProduct.updated_at).toISOString(),
        };

        const resolved = resolveOfflineItemPricing(product, item)

        subtotalBs += resolved.subtotal_bs
        subtotalUsd += resolved.subtotal_usd
        discountBs += resolved.discount_bs
        discountUsd += resolved.discount_usd

        saleItems.push({
          line_id: randomUUID(),
          product_id: item.product_id,
          qty: resolved.qty,
          unit_price_bs: resolved.unit_price_bs,
          unit_price_usd: resolved.unit_price_usd,
          discount_bs: resolved.discount_bs,
          discount_usd: resolved.discount_usd,
          is_weight_product: resolved.is_weight_product,
          weight_unit: resolved.weight_unit,
          weight_value: resolved.weight_value,
          price_per_weight_bs: resolved.price_per_weight_bs,
          price_per_weight_usd: resolved.price_per_weight_usd,
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

      const requestId = randomUUID()
      const payload: SaleCreatedPayload = {
        sale_id: saleId,
        request_id: requestId,
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
        customer_id: data.customer_id || undefined, // ⚠️ CRÍTICO: Incluir customer_id directamente
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
        logger.info('Venta guardada localmente (conexión perdida)', { saleId })
      } catch (error) {
        logger.error('Error guardando venta localmente', error)
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
          is_weight_product: item.is_weight_product,
          weight_unit: item.weight_unit,
          weight_value: item.weight_value,
          price_per_weight_bs: item.price_per_weight_bs,
          price_per_weight_usd: item.price_per_weight_usd,
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
      logger.debug('Sending sale data (before cleaning)', {
        cash_session_id: data.cash_session_id,
        payment_method: data.payment_method,
        items_count: data.items?.length,
      })

      // Filtrar campos undefined y cadenas vacías, pero mantener null explícitos y números 0
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(
          ([key, value]) =>
            !['store_id', 'user_id', 'user_role'].includes(key) &&
            value !== undefined &&
            value !== '' &&
            // Asegurar que payment_method o exchange_rate no sean nulos si son requeridos
            (key !== 'exchange_rate' || (value !== null && value !== 0))
        )
      ) as CreateSaleRequest

      // Asegurar que exchange_rate es válido
      if (!cleanedData.exchange_rate || cleanedData.exchange_rate <= 0) {
        logger.warn('Tasa de cambio inválida, intentando recuperar última conocida', { rate: cleanedData.exchange_rate });
        cleanedData.exchange_rate = await exchangeService.getCachedRate().then(r => r.rate || 36);
      }

      logger.debug('Sending sale data (after cleaning)', {
        cash_session_id: cleanedData.cash_session_id,
        hasCashSessionId: 'cash_session_id' in cleanedData,
      })

      // El interceptor de axios ya rechaza si está offline, así que esto solo se ejecuta si está online
      logger.debug('Iniciando llamada HTTP')

      // ⚡ OPTIMIZACIÓN: Timeout más largo para creación de ventas (60s) ya que puede tener muchos items
      const response = await api
        .post<Sale>('/sales', cleanedData, {
          timeout: 60000, // 60 segundos para ventas (más que el timeout global de 30s)
          ...(options?.returnMode
            ? { params: { return: options.returnMode } }
            : {}),
        })
        .then((res: AxiosResponse<Sale>) => {
          logger.debug('Respuesta HTTP recibida exitosamente')
          return res
        }).catch((err: unknown) => {
          logger.error('Error en llamada HTTP', err)
          throw err
        })

      logger.info('Venta procesada exitosamente', { saleId: response.data?.id })
      return response.data
    } catch (error: unknown) {
      // Si falla por error de red, timeout, o error offline y tenemos los datos necesarios, guardar offline
      // El interceptor de axios rechaza con ERR_INTERNET_DISCONNECTED si está offline
      const axiosError = error as { response?: unknown; code?: string; message?: string; isOffline?: boolean };
      const isNetworkError =
        !axiosError.response ||
        axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ERR_NETWORK' ||
        axiosError.code === 'ERR_INTERNET_DISCONNECTED' ||
        axiosError.isOffline ||
        !isApplicationOnline()

      logger.debug('Error capturado en catch', {
        code: axiosError.code,
        isOffline: axiosError.isOffline,
        message: axiosError.message,
        navigatorOnLine: navigator.onLine,
        connectivityOnline: connectivityService.online,
        appOnline: isApplicationOnline(),
        isNetworkError,
        hasStoreId: !!data.store_id,
        hasUserId: !!data.user_id,
      })

      // Si no es un error de red o no tenemos los datos necesarios, lanzar el error
      if (!isNetworkError || !data.store_id || !data.user_id) {
        logger.error('Error no manejable o faltan datos', error)
        throw error
      }

      logger.warn('Error de red detectado - guardando offline como fallback')

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
            logger.warn('No se encontró tasa de cambio guardada, usando valor por defecto', { exchangeRate })
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
          const localProduct = await db.getProductById(item.product_id)
          if (!localProduct) continue

          // ⚡ FIX: Convertir LocalProduct a Product (updated_at: number -> string)
          const product: Product = {
            ...localProduct,
            updated_at: new Date(localProduct.updated_at).toISOString(),
          };

          const resolved = resolveOfflineItemPricing(product, item)

          subtotalBs += resolved.subtotal_bs
          subtotalUsd += resolved.subtotal_usd
          discountBs += resolved.discount_bs
          discountUsd += resolved.discount_usd

          saleItems.push({
            line_id: randomUUID(),
            product_id: item.product_id,
            qty: resolved.qty,
            unit_price_bs: resolved.unit_price_bs,
            unit_price_usd: resolved.unit_price_usd,
            discount_bs: resolved.discount_bs,
            discount_usd: resolved.discount_usd,
            is_weight_product: resolved.is_weight_product,
            weight_unit: resolved.weight_unit,
            weight_value: resolved.weight_value,
            price_per_weight_bs: resolved.price_per_weight_bs,
            price_per_weight_usd: resolved.price_per_weight_usd,
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

        const requestId = randomUUID()
        const payload: SaleCreatedPayload = {
          sale_id: saleId,
          request_id: requestId,
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
          logger.info('Venta guardada localmente después de error de red', { saleId })
        } catch (error) {
          logger.error('Error guardando venta localmente después de error de red', error)
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
            is_weight_product: item.is_weight_product,
            weight_unit: item.weight_unit,
            weight_value: item.weight_value,
            price_per_weight_bs: item.price_per_weight_bs,
            price_per_weight_usd: item.price_per_weight_usd,
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

  async voidSale(id: string, reason?: string): Promise<Sale> {
    const response = await api.post<Sale>(`/sales/${id}/void`, {
      reason: reason || undefined,
    })
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

  /**
   * Devuelve parcialmente items de una venta
   * @param saleId - ID de la venta
   * @param items - Items a devolver con cantidades
   * @param reason - Razón opcional de la devolución
   */
  async returnItems(
    saleId: string,
    items: ReturnSaleItemDto[],
    reason?: string
  ): Promise<SaleReturn> {
    const response = await api.post<SaleReturn>(`/sales/${saleId}/return`, {
      items,
      reason: reason || undefined,
    })
    return response.data
  },
}

// DTO para item de devolución
export interface ReturnSaleItemDto {
  sale_item_id: string
  qty: number
  note?: string
  serial_ids?: string[]
}

// Respuesta de devolución
export interface SaleReturn {
  id: string
  store_id: string
  sale_id: string
  created_by: string | null
  created_at: string
  reason: string | null
  total_bs: number
  total_usd: number
  items: SaleReturnItem[]
}

export interface SaleReturnItem {
  id: string
  return_id: string
  sale_item_id: string
  qty: number
  unit_price_bs: number
  unit_price_usd: number
  subtotal_bs: number
  subtotal_usd: number
  note: string | null
}
