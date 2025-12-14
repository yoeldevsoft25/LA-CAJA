import { api } from '@/lib/api'

export interface Customer {
  id: string
  store_id: string
  name: string
  document_id: string | null
  phone: string | null
  note: string | null
  updated_at: string
}

export interface CreateCustomerDto {
  name: string
  document_id?: string
  phone?: string
  note?: string
}

export interface UpdateCustomerDto {
  name?: string
  phone?: string
  note?: string
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
}

