import { api } from '@/lib/api'

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

export const customersService = {
  async search(search?: string): Promise<Customer[]> {
    const response = await api.get<Customer[]>('/customers', {
      params: search ? { search } : {},
    })
    return response.data
  },

  async getById(id: string): Promise<Customer> {
    const response = await api.get<Customer>(`/customers/${id}`)
    return response.data
  },

  async create(data: CreateCustomerDto): Promise<Customer> {
    const response = await api.post<Customer>('/customers', data)
    return response.data
  },

  async update(id: string, data: UpdateCustomerDto): Promise<Customer> {
    const response = await api.put<Customer>(`/customers/${id}`, data)
    return response.data
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
}
