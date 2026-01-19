import { api } from '@/lib/api'

export interface LoginRequest {
  store_id: string
  pin: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user_id: string
  store_id: string
  role: 'owner' | 'cashier'
  full_name: string | null
  license_status?: string
  license_expires_at?: string | null
  license_plan?: string | null
  expires_in?: number
}

export interface Store {
  id: string
  name: string
  license_status?: string
  license_expires_at?: string | null
}

export interface Cashier {
  user_id: string
  full_name: string | null
  role: string
}

export interface RegisterRequest {
  store_name: string
  owner_name: string
  owner_pin: string
  cashier_name: string
  cashier_pin: string
}

export interface RegisterResponse {
  store_id: string
  store_name: string
  owner_id: string
  cashier_id: string
  license_status: string
  license_plan: string
  license_expires_at: string
  license_grace_days: number
  trial_days_remaining: number
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

  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const response = await api.post<{ access_token: string; refresh_token: string }>(
      '/auth/refresh',
      { refresh_token: refreshToken }
    )
    return response.data
  },

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data)
    return response.data
  },
}
