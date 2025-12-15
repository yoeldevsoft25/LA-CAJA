import { api } from '@/lib/api'

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
    const res = await api.get<AdminStore[]>('/admin/stores', {
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
    const res = await api.patch(`/admin/stores/${storeId}/license`, payload, {
      headers: { 'x-admin-key': key },
    })
    return res.data
  },

  async startTrial(storeId: string, days?: number, grace_days?: number) {
    const key = ensureKey()
    const res = await api.post(
      `/admin/stores/${storeId}/trial`,
      { days, grace_days },
      { headers: { 'x-admin-key': key } }
    )
    return res.data
  },
}

export const adminService = adminServiceObj
