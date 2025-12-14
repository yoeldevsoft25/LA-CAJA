import { api } from '@/lib/api'

export interface LoginRequest {
  store_id: string
  pin: string
}

export interface LoginResponse {
  access_token: string
  user_id: string
  store_id: string
  role: 'owner' | 'cashier'
  full_name: string | null
}

export interface Store {
  id: string
  name: string
}

export interface Cashier {
  user_id: string
  full_name: string | null
  role: string
}

export const authService = {
  async getStores(): Promise<Store[]> {
    const response = await api.get<Store[]>('/auth/stores')
    return response.data
  },

  async getCashiers(storeId: string): Promise<Cashier[]> {
    const response = await api.get<Cashier[]>(`/auth/stores/${storeId}/cashiers`)
    return response.data
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data)
    return response.data
  },
}

