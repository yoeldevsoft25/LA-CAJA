import { api } from '@/lib/api'
import { CacheManager, CacheLevel } from '@la-caja/sync'
import { db, LocalCustomer } from '@/db/database'

// Singleton del cache manager para clientes
const customerCache = new CacheManager('customers-cache')

export interface Customer {
  id: string
  store_id: string
  name: string
  document_id: string | null
  phone: string | null
  email: string | null
  credit_limit: number | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface CreateCustomerDto {
  name: string
  document_id?: string
  phone?: string
  email?: string
  credit_limit?: number | null
  note?: string
}

export interface UpdateCustomerDto {
  name?: string
  document_id?: string
  phone?: string
  email?: string
  credit_limit?: number | null
  note?: string
}

export interface CustomerPurchaseHistory {
  total_purchases: number
  total_amount_usd: number
  total_amount_bs: number
  first_purchase_at: string | null
  last_purchase_at: string | null
  average_purchase_usd: number
  recent_sales: Array<{
    id: string
    sale_number: number | null
    sold_at: string
    total_usd: number
    total_bs: number
    payment_method: string
  }>
}

export interface CreditCheckResult {
  available: boolean
  credit_limit: number | null
  current_debt: number
  available_credit: number
  message: string
}

/**
 * Guarda un cliente en IndexedDB para acceso offline
 */
async function saveCustomerToLocalDB(customer: Customer): Promise<void> {
  try {
    const localCustomer: LocalCustomer = {
      id: customer.id,
      store_id: customer.store_id,
      name: customer.name,
      document_id: customer.document_id || null,
      phone: customer.phone || null,
      note: customer.note || null,
      updated_at: new Date(customer.updated_at).getTime(),
      cached_at: Date.now(),
    }
    await db.customers.put(localCustomer)
  } catch (error) {
    console.error('[CustomersService] Error saving to local DB:', error)
  }
}

/**
 * Guarda múltiples clientes en IndexedDB
 */
async function saveCustomersToLocalDB(customers: Customer[]): Promise<void> {
  try {
    const localCustomers: LocalCustomer[] = customers.map((customer) => ({
      id: customer.id,
      store_id: customer.store_id,
      name: customer.name,
      document_id: customer.document_id || null,
      phone: customer.phone || null,
      note: customer.note || null,
      updated_at: new Date(customer.updated_at).getTime(),
      cached_at: Date.now(),
    }))
    await db.customers.bulkPut(localCustomers)
  } catch (error) {
    console.error('[CustomersService] Error bulk saving to local DB:', error)
  }
}

export const customersService = {
  async search(search?: string): Promise<Customer[]> {
    const cacheKey = search ? `customers:search:${search}` : 'customers:all'
    
    // 1. Intentar desde cache
    if (navigator.onLine) {
      const cached = await customerCache.get<Customer[]>(cacheKey)
      if (cached) {
        console.log('[CustomersService] Cache hit:', cacheKey)
        return cached
      }
    }

    // 2. Si offline, buscar en IndexedDB local
    if (!navigator.onLine) {
      console.log('[CustomersService] Offline mode: searching in IndexedDB')
      const localCustomers = await db.customers.toArray()
      
      if (search) {
        const searchLower = search.toLowerCase()
        const filtered = localCustomers.filter(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            (c.document_id && c.document_id.toLowerCase().includes(searchLower)) ||
            (c.phone && c.phone.toLowerCase().includes(searchLower))
        )
        return filtered.map((c) => ({
          id: c.id,
          store_id: c.store_id,
          name: c.name,
          document_id: c.document_id,
          phone: c.phone,
          email: null, // No se guarda email en local DB
          credit_limit: null, // No se guarda credit_limit en local DB
          note: c.note,
          created_at: new Date(c.cached_at).toISOString(),
          updated_at: new Date(c.updated_at).toISOString(),
        }))
      }
      
      return localCustomers.map((c) => ({
        id: c.id,
        store_id: c.store_id,
        name: c.name,
        document_id: c.document_id,
        phone: c.phone,
        email: null,
        credit_limit: null,
        note: c.note,
        created_at: new Date(c.cached_at).toISOString(),
        updated_at: new Date(c.updated_at).toISOString(),
      }))
    }

    // 3. Online: fetch del servidor
    try {
      const response = await api.get<Customer[]>('/customers', {
        params: search ? { search } : {},
      })
      const customers = response.data

      // Guardar en cache y IndexedDB
      await customerCache.set(cacheKey, customers, CacheLevel.L2)
      await saveCustomersToLocalDB(customers)

      return customers
    } catch (error) {
      // Si falla la petición, intentar desde IndexedDB como fallback
      console.warn('[CustomersService] API error, falling back to IndexedDB:', error)
      const localCustomers = await db.customers.toArray()
      if (search) {
        const searchLower = search.toLowerCase()
        return localCustomers
          .filter(
            (c) =>
              c.name.toLowerCase().includes(searchLower) ||
              (c.document_id && c.document_id.toLowerCase().includes(searchLower)) ||
              (c.phone && c.phone.toLowerCase().includes(searchLower))
          )
          .map((c) => ({
            id: c.id,
            store_id: c.store_id,
            name: c.name,
            document_id: c.document_id,
            phone: c.phone,
            email: null,
            credit_limit: null,
            note: c.note,
            created_at: new Date(c.cached_at).toISOString(),
            updated_at: new Date(c.updated_at).toISOString(),
          }))
      }
      return localCustomers.map((c) => ({
        id: c.id,
        store_id: c.store_id,
        name: c.name,
        document_id: c.document_id,
        phone: c.phone,
        email: null,
        credit_limit: null,
        note: c.note,
        created_at: new Date(c.cached_at).toISOString(),
        updated_at: new Date(c.updated_at).toISOString(),
      }))
    }
  },

  async getById(id: string): Promise<Customer> {
    const cacheKey = `customer:${id}`
    
    // 1. Intentar desde cache
    if (navigator.onLine) {
      const cached = await customerCache.get<Customer>(cacheKey)
      if (cached) {
        console.log('[CustomersService] Cache hit:', cacheKey)
        return cached
      }
    }

    // 2. Si offline, buscar en IndexedDB local
    if (!navigator.onLine) {
      console.log('[CustomersService] Offline mode: searching in IndexedDB')
      const localCustomer = await db.customers.get(id)
      if (localCustomer) {
        return {
          id: localCustomer.id,
          store_id: localCustomer.store_id,
          name: localCustomer.name,
          document_id: localCustomer.document_id,
          phone: localCustomer.phone,
          email: null,
          credit_limit: null,
          note: localCustomer.note,
          created_at: new Date(localCustomer.cached_at).toISOString(),
          updated_at: new Date(localCustomer.updated_at).toISOString(),
        }
      }
      throw new Error(`Cliente ${id} no encontrado en cache local`)
    }

    // 3. Online: fetch del servidor
    try {
      const response = await api.get<Customer>(`/customers/${id}`)
      const customer = response.data

      // Guardar en cache y IndexedDB
      await customerCache.set(cacheKey, customer, CacheLevel.L2)
      await saveCustomerToLocalDB(customer)

      return customer
    } catch (error) {
      // Si falla, intentar desde IndexedDB como fallback
      console.warn('[CustomersService] API error, falling back to IndexedDB:', error)
      const localCustomer = await db.customers.get(id)
      if (localCustomer) {
        return {
          id: localCustomer.id,
          store_id: localCustomer.store_id,
          name: localCustomer.name,
          document_id: localCustomer.document_id,
          phone: localCustomer.phone,
          email: null,
          credit_limit: null,
          note: localCustomer.note,
          created_at: new Date(localCustomer.cached_at).toISOString(),
          updated_at: new Date(localCustomer.updated_at).toISOString(),
        }
      }
      throw error
    }
  },

  async create(data: CreateCustomerDto): Promise<Customer> {
    const response = await api.post<Customer>('/customers', data)
    const customer = response.data

    // Invalidar cache de búsqueda
    await customerCache.invalidatePattern(/^customers:/)
    // Guardar nuevo cliente en IndexedDB
    await saveCustomerToLocalDB(customer)
    // Cachear por ID
    await customerCache.set(`customer:${customer.id}`, customer, CacheLevel.L2)

    return customer
  },

  async update(id: string, data: UpdateCustomerDto): Promise<Customer> {
    const response = await api.put<Customer>(`/customers/${id}`, data)
    const customer = response.data

    // Invalidar cache
    await customerCache.invalidate(`customer:${id}`)
    await customerCache.invalidatePattern(/^customers:/)
    // Actualizar en IndexedDB
    await saveCustomerToLocalDB(customer)
    // Cachear actualizado
    await customerCache.set(`customer:${id}`, customer, CacheLevel.L2)

    return customer
  },

  /**
   * Get customer's purchase history including summary and recent sales
   */
  async getPurchaseHistory(
    customerId: string,
    limit = 10
  ): Promise<CustomerPurchaseHistory> {
    const response = await api.get<CustomerPurchaseHistory>(
      `/customers/${customerId}/purchase-history`,
      { params: { limit: limit.toString() } }
    )
    return response.data
  },

  /**
   * Check if customer has available credit for a FIAO purchase
   */
  async checkCredit(
    customerId: string,
    amountUsd: number
  ): Promise<CreditCheckResult> {
    const response = await api.get<CreditCheckResult>(
      `/customers/${customerId}/credit-check`,
      { params: { amount: amountUsd.toString() } }
    )
    return response.data
  },

  /**
   * Delete a customer by ID
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/customers/${id}`)

    // Invalidar cache y remover de IndexedDB
    await customerCache.invalidate(`customer:${id}`)
    await customerCache.invalidatePattern(/^customers:/)
    await db.customers.delete(id)
  },

  /**
   * Búsqueda offline: busca en IndexedDB local
   */
  async searchOffline(search?: string): Promise<Customer[]> {
    const localCustomers = await db.customers.toArray()
    
    if (search) {
      const searchLower = search.toLowerCase()
      const filtered = localCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          (c.document_id && c.document_id.toLowerCase().includes(searchLower)) ||
          (c.phone && c.phone.toLowerCase().includes(searchLower))
      )
      return filtered.map((c) => ({
        id: c.id,
        store_id: c.store_id,
        name: c.name,
        document_id: c.document_id,
        phone: c.phone,
        email: null,
        credit_limit: null,
        note: c.note,
        created_at: new Date(c.cached_at).toISOString(),
        updated_at: new Date(c.updated_at).toISOString(),
      }))
    }
    
    return localCustomers.map((c) => ({
      id: c.id,
      store_id: c.store_id,
      name: c.name,
      document_id: c.document_id,
      phone: c.phone,
      email: null,
      credit_limit: null,
      note: c.note,
      created_at: new Date(c.cached_at).toISOString(),
      updated_at: new Date(c.updated_at).toISOString(),
    }))
  },

  /**
   * Obtener cliente offline: busca en IndexedDB local
   */
  async getByIdOffline(id: string): Promise<Customer | null> {
    const localCustomer = await db.customers.get(id)
    if (!localCustomer) {
      return null
    }
    
    return {
      id: localCustomer.id,
      store_id: localCustomer.store_id,
      name: localCustomer.name,
      document_id: localCustomer.document_id,
      phone: localCustomer.phone,
      email: null,
      credit_limit: null,
      note: localCustomer.note,
      created_at: new Date(localCustomer.cached_at).toISOString(),
      updated_at: new Date(localCustomer.updated_at).toISOString(),
    }
  },
}
