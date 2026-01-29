import { api } from '@/lib/api'
import { Customer, customersService } from './customers.service'
import { syncService } from './sync.service'
import { db } from '@/db/database'
import { BaseEvent } from '@la-caja/domain'

export type DebtStatus = 'open' | 'partial' | 'paid'

export type PaymentMethod = 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER'

export interface DebtPayment {
  id: string
  store_id: string
  debt_id: string
  paid_at: string
  amount_bs: number
  amount_usd: number
  method: PaymentMethod
  note: string | null
}

export interface Debt {
  id: string
  store_id: string
  sale_id: string | null
  customer_id: string
  customer?: Customer
  created_at: string
  amount_bs: number
  amount_usd: number
  status: DebtStatus
  note?: string
  payments: DebtPayment[]
  sale?: {
    id: string
    sold_at: string
    totals: {
      total_bs: number
      total_usd: number
    }
    items?: Array<{
      id: string
      product_id: string
      product?: {
        id: string
        name: string
        sku?: string | null
      }
      variant?: {
        id: string
        name: string
      } | null
      qty: number
      unit_price_bs: number
      unit_price_usd: number
      discount_bs: number
      discount_usd: number
      is_weight_product?: boolean
      weight_unit?: string | null
      weight_value?: number | null
    }>
  }
}

export interface DebtSummary {
  total_debt_bs: number
  total_debt_usd: number
  total_paid_bs: number
  total_paid_usd: number
  remaining_bs: number
  remaining_usd: number
  open_debts_count: number
  total_debts_count: number
}

export interface CreateDebtPaymentDto {
  amount_bs: number
  amount_usd: number
  method: PaymentMethod
  note?: string
  // Meta data para offline
  store_id?: string
  user_id?: string
}

export interface DebtWithCalculations extends Debt {
  total_paid_bs: number
  total_paid_usd: number
  remaining_bs: number
  remaining_usd: number
}

// Helper para calcular totales de una deuda
export function calculateDebtTotals(debt: Debt): DebtWithCalculations {
  const totalPaidBs = (debt.payments || []).reduce((sum, p) => sum + Number(p.amount_bs), 0)
  const totalPaidUsd = (debt.payments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0)

  return {
    ...debt,
    total_paid_bs: totalPaidBs,
    total_paid_usd: totalPaidUsd,
    remaining_bs: Number(debt.amount_bs) - totalPaidBs,
    remaining_usd: Number(debt.amount_usd) - totalPaidUsd,
  }
}

// Función auxiliar para UUID
function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const debtsService = {
  // Listar todas las deudas (opcionalmente filtradas por estado)
  async findAll(status?: DebtStatus, storeId?: string): Promise<Debt[]> {
    if (!navigator.onLine && storeId) {
      try {
        let collection = db.debts.where('store_id').equals(storeId)
        if (status) {
          collection = collection.filter(d => d.status === status)
        }
        const localDebts = await collection.toArray()

        // Mapear LocalDebt a Debt
        // Nota: El join con customers/sales es costoso en IndexedDB, aqui hacemos lo basico
        return Promise.all(localDebts.map(async (d) => {
          const customer = await customersService.getById(d.customer_id)
          return {
            ...d,
            customer,
            created_at: new Date(d.created_at).toISOString(),
            payments: [], // TODO: store payments locally?
            // Se requeriría mas lógica para reconstruir payments desde eventos o tabla separada
          } as Debt
        }))
      } catch (err) {
        console.error('Error fetching offline debts', err)
        return []
      }
    }

    const response = await api.get<Debt[]>('/debts', {
      params: status ? { status } : {},
    })
    return response.data
  },

  // Obtener una deuda por ID
  async findOne(id: string): Promise<Debt> {
    if (!navigator.onLine) {
      const local = await db.debts.get(id)
      if (local) {
        const customer = await customersService.getById(local.customer_id)
        return {
          ...local,
          customer,
          created_at: new Date(local.created_at).toISOString(),
          payments: [], // Limite actual del offline
        } as Debt
      }
    }
    const response = await api.get<Debt>(`/debts/${id}`)
    return response.data
  },

  // Obtener deudas de un cliente específico
  async getByCustomer(customerId: string, includePaid = false): Promise<Debt[]> {
    if (!navigator.onLine) {
      // Offline fallback logic could go here similar to findAll
    }
    const response = await api.get<Debt[]>(`/debts/customer/${customerId}`, {
      params: { include_paid: includePaid.toString() },
    })
    return response.data
  },

  // Obtener resumen de deudas de un cliente
  async getCustomerSummary(customerId: string): Promise<DebtSummary> {
    const response = await api.get<DebtSummary>(`/debts/customer/${customerId}/summary`)
    return response.data
  },

  // Registrar un pago/abono a una deuda
  async addPayment(debtId: string, data: CreateDebtPaymentDto): Promise<{ debt: Debt; payment: DebtPayment }> {
    if (!navigator.onLine) {
      if (!data.store_id || !data.user_id) throw new Error('Offline payment requires store_id and user_id')

      // 1. Crear evento
      const paymentId = randomUUID()
      const now = Date.now()

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: data.store_id,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0, // SyncService assignará seq
        type: 'DebtPaymentAdded',
        version: 1,
        created_at: now,
        actor: { user_id: data.user_id, role: 'cashier' }, // Asumimos cashier si no viene
        payload: {
          payment_id: paymentId,
          debt_id: debtId,
          amount_bs: data.amount_bs,
          amount_usd: data.amount_usd,
          method: data.method,
          note: data.note,
          paid_at: now
        }
      }

      // 2. Encolar y aplicar optimista
      await syncService.enqueueEvent(event)

      // 3. Proyectar localmente (optimistic update)
      // Ya que enqueueEvent guarda en DB, projectionManager lo podria tomar si escuchase cambios,
      // pero aqui lo forzamos o dejamos que ProjectionManager.applyDebtPaymentAdded lo haga si sync lo llama.
      // SyncService llama a saveEventToDB pero NO llama a ProjectionManager automáticamente para eventos propios (aun).
      // Deberíamos llamar manualmente a la proyección para updatear la UI inmediata.
      const { projectionManager } = await import('./projection.manager')
      await projectionManager.applyDebtPaymentAdded(event)

      // 4. Retornar Mock
      const debt = await this.findOne(debtId) // Ahora traerá el actualizado de Dexie
      return {
        debt,
        payment: {
          id: paymentId,
          store_id: data.store_id,
          debt_id: debtId,
          paid_at: new Date(now).toISOString(),
          amount_bs: data.amount_bs,
          amount_usd: data.amount_usd,
          method: data.method,
          note: data.note || null
        }
      }
    }

    // Excluir store_id y user_id del payload para la API (ya van en el token)
    const { store_id, user_id, ...payload } = data
    const response = await api.post<{ debt: Debt; payment: DebtPayment }>(`/debts/${debtId}/payments`, payload)
    return response.data
  },

  // Crear deuda desde una venta FIAO (usado internamente)
  async createFromSale(saleId: string, customerId: string): Promise<Debt> {
    // Este metodo suele llamarse desde el backend automáticamente al crear venta FIAO
    // En offline, la venta FIAO crea la deuda mediante logica de backend o evento. 
    // Por ahora, lo mantenemos online-only o asumimos que 'SaleCreated' con FIAO genera la deuda en el backend/proyeccion.
    const response = await api.post<Debt>(`/debts/from-sale/${saleId}`, { customer_id: customerId })
    return response.data
  },

  // Enviar recordatorio de deudas por WhatsApp.
  async sendDebtReminder(
    customerId: string,
    debtIds?: string[],
  ): Promise<{ success: boolean; error?: string }> {
    const response = await api.post<{ success: boolean; error?: string }>(
      `/debts/customer/${customerId}/send-reminder`,
      debtIds && debtIds.length > 0 ? { debt_ids: debtIds } : {},
    )
    return response.data
  },

  // Pagar todas las deudas pendientes de un cliente
  async payAllDebts(customerId: string, data: CreateDebtPaymentDto): Promise<{ debts: Debt[]; payments: DebtPayment[] }> {
    // Excluir store_id y user_id del payload para la API
    const { store_id, user_id, ...payload } = data
    const response = await api.post<{ debts: Debt[]; payments: DebtPayment[] }>(
      `/debts/customer/${customerId}/pay-all`,
      payload
    )
    return response.data
  },

  // Crear deuda antigua (Legacy) sin venta asociada
  async createLegacy(data: { customer_id: string; amount_usd: number; note?: string; created_at?: string; store_id?: string; user_id?: string }): Promise<Debt> {
    if (!navigator.onLine) {
      if (!data.store_id || !data.user_id) throw new Error('Offline legacy debt requires store_id and user_id')

      const debtId = randomUUID()
      const now = Date.now()
      const exchangeRate = 36 // Fallback o leer de config
      const amountBs = data.amount_usd * exchangeRate

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: data.store_id,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0,
        type: 'DebtCreated',
        version: 1,
        created_at: now,
        actor: { user_id: data.user_id, role: 'owner' },
        payload: {
          debt_id: debtId,
          customer_id: data.customer_id,
          amount_bs: amountBs,
          amount_usd: data.amount_usd,
          sale_id: null,
          note: data.note,
          status: 'open',
          is_legacy: true
        }
      }

      await syncService.enqueueEvent(event)

      const { projectionManager } = await import('./projection.manager')
      await projectionManager.applyDebtCreated(event)

      // Mock return
      return {
        id: debtId,
        store_id: data.store_id,
        sale_id: null,
        customer_id: data.customer_id,
        created_at: new Date(now).toISOString(),
        amount_bs: amountBs,
        amount_usd: data.amount_usd,
        status: 'open',
        note: data.note,
        payments: []
      } as Debt
    }

    const { store_id, user_id, ...payload } = data
    const response = await api.post<Debt>('/debts/legacy', payload)
    return response.data
  },
}
