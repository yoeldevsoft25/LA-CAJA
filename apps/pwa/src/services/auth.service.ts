import { api } from '@/lib/api'
import { db } from '@/db/database'

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

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
  owner_email: string
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
    const response = await api.get<Store[]>('/auth/stores/public')
    return Array.isArray(response.data) ? response.data : []
  },

  async getCashiers(storeId: string): Promise<Cashier[]> {
    const response = await api.get<Cashier[]>(`/auth/stores/${storeId}/cashiers/public`)
    return Array.isArray(response.data) ? response.data : []
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const isOnline = navigator.onLine

    if (!isOnline) {
      return this.loginOffline(data)
    }

    const response = await api.post<LoginResponse>('/auth/login', data)
    return response.data
  },

  async loginOffline(data: LoginRequest): Promise<LoginResponse> {
    const backupHashes = await db.kv.get(`offline_creds:${data.store_id}`)
    if (!backupHashes || !Array.isArray(backupHashes.value)) {
      throw new Error('No hay credenciales offline guardadas para esta tienda. Necesitas internet para el primer login.')
    }

    // En el flujo de la UI, el usuario ya ha sido seleccionado (usualmente guardamos user_id en sessionStorage o similar)
    // O el frontend pasa el user_id en el LoginRequest extendido.
    // Vamos a buscar si hay un match de PIN con CUALQUIER usuario de esa tienda que tenga el PIN ingresado.
    // (Nota: En Velox, el login es Store + PIN, el PIN identifica al usuario dentro de la tienda si es único,
    // o el usuario se selecciona previamente).

    // Asumiremos que el frontend nos pasa el user_id si ya lo seleccionó, o buscamos por PIN.
    const bcrypt = await import('bcryptjs')

    let foundMember = null
    for (const member of backupHashes.value) {
      if (member.pin_hash && await bcrypt.compare(data.pin, member.pin_hash)) {
        foundMember = member
        break
      }
    }

    if (!foundMember) {
      throw new Error('PIN incorrecto (Modo Offline)')
    }

    // Mock de respuesta de login satisfactoria
    return {
      access_token: 'offline_token_' + randomUUID(),
      refresh_token: 'offline_refresh_' + randomUUID(),
      user_id: foundMember.user_id,
      store_id: data.store_id,
      role: foundMember.role,
      full_name: foundMember.full_name || 'Usuario Offline',
      expires_in: 3600 * 24, // 24h
    }
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

  async verifyEmail(token: string): Promise<{ verified: boolean; message: string }> {
    const response = await api.post<{ verified: boolean; message: string }>('/auth/verify-email', { token })
    return response.data
  },

  async resendVerificationEmail(): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/resend-verification-email')
    return response.data
  },

  async forgotPin(email: string, storeId: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/forgot-pin', { email, store_id: storeId })
    return response.data
  },

  async resetPin(token: string, newPin: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/reset-pin', { token, new_pin: newPin })
    return response.data
  },

  async getActiveSessions(): Promise<Array<{
    id: string
    device_id: string | null
    device_info: string | null
    ip_address: string | null
    created_at: string
    last_used_at: string | null
  }>> {
    const response = await api.get<Array<{
      id: string
      device_id: string | null
      device_info: string | null
      ip_address: string | null
      created_at: string
      last_used_at: string | null
    }>>('/auth/sessions')
    return response.data
  },

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/auth/sessions/${sessionId}`)
    return response.data
  },

  async initiate2FA(): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const response = await api.get<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>('/auth/2fa/initiate')
    return response.data
  },

  async enable2FA(verificationCode: string): Promise<{ enabled: boolean; message: string }> {
    const response = await api.post<{ enabled: boolean; message: string }>('/auth/2fa/enable', {
      verification_code: verificationCode,
    })
    return response.data
  },

  async disable2FA(verificationCode: string): Promise<{ disabled: boolean; message: string }> {
    const response = await api.post<{ disabled: boolean; message: string }>('/auth/2fa/disable', {
      verification_code: verificationCode,
    })
    return response.data
  },

  async verify2FA(code: string): Promise<{ verified: boolean }> {
    const response = await api.post<{ verified: boolean }>('/auth/2fa/verify', { code })
    return response.data
  },

  async get2FAStatus(): Promise<{ is_enabled: boolean; enabled_at: string | null }> {
    const response = await api.get<{ is_enabled: boolean; enabled_at: string | null }>('/auth/2fa/status')
    return response.data
  },
}
