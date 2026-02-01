import { api } from '@/lib/api'

export interface LicenseStatus {
    plan: string
    status: string
    expires_at: string | null
    features: string[]
    limits: Record<string, number>
    usage: Record<string, number>
    token: string
}

export const licenseService = {
    async getStatus(): Promise<LicenseStatus> {
        const response = await api.get<LicenseStatus>('/licenses/status')

        // Guardar en localStorage para acceso offline
        if (response.data) {
            localStorage.setItem('velox_license_status', JSON.stringify(response.data))
            localStorage.setItem('velox_offline_token', response.data.token)
        }

        return response.data
    },

    getLocalStatus(): LicenseStatus | null {
        const stored = localStorage.getItem('velox_license_status')
        if (stored) {
            try {
                return JSON.parse(stored)
            } catch (e) {
                return null
            }
        }
        return null
    },

    hasFeature(feature: string): boolean {
        const status = this.getLocalStatus()
        if (!status) return false
        return status.features.includes(feature)
    },

    getQuotaRemaining(metric: string): number {
        const status = this.getLocalStatus()
        if (!status) return 0

        const limit = status.limits[metric] ?? Infinity
        const used = status.usage[metric] ?? 0

        return Math.max(0, limit - used)
    },

    isOverQuota(metric: string): boolean {
        const status = this.getLocalStatus()
        if (!status) return false

        const limit = status.limits[metric] ?? Infinity
        const used = status.usage[metric] ?? 0

        return used >= limit
    },

    decodeOfflineToken(token: string): any {
        try {
            const base64Url = token.split('.')[1]
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            )
            return JSON.parse(jsonPayload)
        } catch (e) {
            return null
        }
    },

    getOfflineStatus(): Partial<LicenseStatus> | null {
        const token = localStorage.getItem('velox_offline_token')
        if (!token) return null

        const payload = this.decodeOfflineToken(token)
        if (!payload) return null

        // Verificar expiración del token offline (exp está en segundos)
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return null
        }

        const expiresAt =
            payload.expires_at
                ? new Date(payload.expires_at).toISOString()
                : payload.exp
                    ? new Date(payload.exp * 1000).toISOString()
                    : null

        return {
            plan: payload.plan,
            status: payload.status,
            expires_at: expiresAt,
            features: payload.features || [],
            limits: payload.limits || {},
            usage: this.getLocalStatus()?.usage || {}, // Usar último uso conocido
            token: token
        }
    }
}
