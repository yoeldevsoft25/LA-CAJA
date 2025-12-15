import axios from 'axios'

function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000'
  }
  const hostname = window.location.hostname
  return `http://${hostname}:3000`
}

const adminApi = axios.create({
  baseURL: getApiUrl(),
  headers: { 'Content-Type': 'application/json' },
})

const ADMIN_KEY_STORAGE = 'admin_key'

function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE)
}

function ensureKey(): string {
  const key = getAdminKey()
  if (!key) throw new Error('Falta admin key')
  return key
}

export interface AdminStore {
  id: string
  name: string
  license_status: string
  license_plan: string | null
  license_expires_at: string | null
  license_grace_days: number
  license_notes: string | null
  created_at: string
  member_count: number
  members: { user_id: string; role: string; full_name: string | null }[]
}

export interface AdminMember {
  store_id: string
  user_id: string
  role: string
  full_name: string | null
  created_at: string
}

const adminServiceObj = {
  setKey(key: string) {
    localStorage.setItem(ADMIN_KEY_STORAGE, key)
  },
  clearKey() {
    localStorage.removeItem(ADMIN_KEY_STORAGE)
  },
  getKey: () => getAdminKey(),

  async listStores(params?: { status?: string; plan?: string; expiring_in_days?: number }) {
    const key = ensureKey()
    const res = await adminApi.get<AdminStore[]>('/admin/stores', {
      params,
      headers: { 'x-admin-key': key },
    })
    return res.data
  },

  async updateLicense(
    storeId: string,
    payload: Partial<{
      status: string
      expires_at: string
      grace_days: number
      plan: string
      notes: string
    }>
  ) {
    const key = ensureKey()
    const res = await adminApi.patch(`/admin/stores/${storeId}/license`, payload, {
      headers: { 'x-admin-key': key },
    })
    return res.data
  },

  async startTrial(storeId: string, days?: number, grace_days?: number) {
    const key = ensureKey()
    const res = await adminApi.post(
      `/admin/stores/${storeId}/trial`,
      { days, grace_days },
      { headers: { 'x-admin-key': key } }
    )
    return res.data
  },

  async listUsers(storeId: string) {
    const key = ensureKey()
    const res = await adminApi.get<AdminMember[]>(`/admin/stores/${storeId}/users`, {
      headers: { 'x-admin-key': key },
    })
    return res.data
  },

  async createUser(storeId: string, payload: { full_name: string; role: string; pin?: string; user_id?: string }) {
    const key = ensureKey()
    const res = await adminApi.post(`/admin/stores/${storeId}/users`, payload, {
      headers: { 'x-admin-key': key },
    })
    return res.data
  },

  async deleteUser(storeId: string, userId: string) {
    const key = ensureKey()
    const res = await adminApi.delete(`/admin/stores/${storeId}/users/${userId}`, {
      headers: { 'x-admin-key': key },
    })
    return res.data
  },
}

export const adminService = adminServiceObj
