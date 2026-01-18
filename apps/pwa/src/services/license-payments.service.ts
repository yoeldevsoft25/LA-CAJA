import { api } from '@/lib/api';
import axios from 'axios';

// Función auxiliar para obtener adminApi (mismo patrón que admin.service.ts)
function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '4173' ||
    window.location.port === '5173'
  ) {
    return 'http://localhost:3000';
  }
  if (import.meta.env.PROD) {
    const hostname = window.location.hostname;
    if (hostname.includes('netlify.app')) {
      return 'https://la-caja-8i4h.onrender.com';
    }
    const protocol = window.location.protocol;
    const port = protocol === 'https:' ? '' : ':3000';
    return `${protocol}//${hostname}${port}`;
  }
  const hostname = window.location.hostname;
  return `http://${hostname}:3000`;
}

const ADMIN_KEY_STORAGE = 'admin_key';

function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE);
}

const adminApi = axios.create({
  baseURL: getApiUrl(),
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para agregar admin key
adminApi.interceptors.request.use((config) => {
  const key = getAdminKey();
  if (key) {
    config.headers['x-admin-key'] = key;
  }
  return config;
});

// Tipos
export type LicensePlan = 'freemium' | 'basico' | 'profesional' | 'empresarial';
export type BillingPeriod = 'monthly' | 'yearly';
export type LicensePaymentMethod =
  | 'pago_movil'
  | 'transferencia'
  | 'zelle'
  | 'efectivo'
  | 'other';
export type LicensePaymentStatus =
  | 'pending'
  | 'verifying'
  | 'verified'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface LicensePayment {
  id: string;
  store_id: string;
  plan: LicensePlan;
  billing_period: BillingPeriod;
  amount_usd: number;
  amount_bs: number | null;
  exchange_rate: number | null;
  payment_method: LicensePaymentMethod;
  payment_reference: string;
  bank_code: string | null;
  phone_number: string | null;
  account_number: string | null;
  status: LicensePaymentStatus;
  verified_at: string | null;
  verified_by: string | null;
  auto_verified: boolean;
  verification_attempts: number;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  documents?: LicensePaymentDocument[];
  verifications?: LicensePaymentVerification[];
  store?: {
    id: string;
    name: string;
  };
}

export interface LicensePaymentDocument {
  id: string;
  payment_id: string;
  file_name: string;
  file_path: string;
  file_type: 'image' | 'pdf' | 'other';
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface LicensePaymentVerification {
  id: string;
  payment_id: string;
  verification_method: 'mercantil_api' | 'banesco_api' | 'manual' | 'other';
  status: 'success' | 'failed' | 'not_found' | 'error';
  response_data: any | null;
  error_message: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface CreatePaymentRequestDto {
  plan: LicensePlan;
  billing_period: BillingPeriod;
  amount_usd: number;
  amount_bs?: number;
  exchange_rate?: number;
  payment_method: LicensePaymentMethod;
  payment_reference: string;
  bank_code?: string;
  phone_number?: string;
  account_number?: string;
  notes?: string;
}

export interface VerifyPaymentDto {
  method?: 'mercantil_api' | 'banesco_api' | 'manual' | 'other';
  auto_verify?: boolean;
  notes?: string;
}

export interface ApprovePaymentDto {
  notes?: string;
}

export interface RejectPaymentDto {
  rejection_reason: string;
  notes?: string;
}

export interface PaymentStats {
  total: number;
  pending: number;
  verified: number;
  approved: number;
  rejected: number;
  expired: number;
}

export interface ListPaymentsResponse {
  payments: LicensePayment[];
  total: number;
}

const licensePaymentsService = {
  /**
   * Crear solicitud de pago (público, requiere autenticación)
   */
  async createPaymentRequest(dto: CreatePaymentRequestDto): Promise<LicensePayment> {
    const res = await api.post<LicensePayment>('/licenses/payments', dto);
    return res.data;
  },

  /**
   * Obtener estado de una solicitud de pago (público, requiere autenticación)
   */
  async getPaymentStatus(paymentId: string): Promise<LicensePayment> {
    const res = await api.get<LicensePayment>(`/licenses/payments/${paymentId}`);
    return res.data;
  },

  /**
   * Listar solicitudes de pago (admin)
   */
  async listPayments(params?: {
    store_id?: string;
    status?: LicensePaymentStatus;
    limit?: number;
    offset?: number;
  }): Promise<ListPaymentsResponse> {
    const res = await adminApi.get<ListPaymentsResponse>(
      '/admin/license-payments',
      { params }
    );
    return res.data;
  },

  /**
   * Obtener detalles de una solicitud (admin)
   */
  async getPaymentDetails(paymentId: string): Promise<LicensePayment> {
    const res = await adminApi.get<LicensePayment>(
      `/admin/license-payments/${paymentId}`
    );
    return res.data;
  },

  /**
   * Verificar un pago (admin)
   */
  async verifyPayment(
    paymentId: string,
    dto: VerifyPaymentDto
  ): Promise<LicensePayment> {
    const res = await adminApi.post<LicensePayment>(
      `/admin/license-payments/${paymentId}/verify`,
      dto
    );
    return res.data;
  },

  /**
   * Aprobar un pago (admin)
   */
  async approvePayment(
    paymentId: string,
    dto: ApprovePaymentDto = {}
  ): Promise<{ payment: LicensePayment; store: any }> {
    const res = await adminApi.post<{ payment: LicensePayment; store: any }>(
      `/admin/license-payments/${paymentId}/approve`,
      dto
    );
    return res.data;
  },

  /**
   * Rechazar un pago (admin)
   */
  async rejectPayment(
    paymentId: string,
    dto: RejectPaymentDto
  ): Promise<LicensePayment> {
    const res = await adminApi.post<LicensePayment>(
      `/admin/license-payments/${paymentId}/reject`,
      dto
    );
    return res.data;
  },

  /**
   * Obtener estadísticas (admin)
   */
  async getStats(storeId?: string): Promise<PaymentStats> {
    const res = await adminApi.get<PaymentStats>(
      '/admin/license-payments/stats',
      { params: { store_id: storeId } }
    );
    return res.data;
  },

  /**
   * Reintentar verificación automática (admin)
   */
  async retryVerification(paymentId: string): Promise<LicensePayment> {
    const res = await adminApi.post<LicensePayment>(
      `/admin/license-payments/${paymentId}/retry-verification`
    );
    return res.data;
  },

  /**
   * Calcular precio esperado según plan y período
   */
  calculateExpectedAmount(plan: LicensePlan, period: BillingPeriod): number {
    const prices: Record<LicensePlan, { monthly: number; yearly: number }> = {
      freemium: { monthly: 0, yearly: 0 },
      basico: { monthly: 29, yearly: 290 },
      profesional: { monthly: 79, yearly: 790 },
      empresarial: { monthly: 199, yearly: 1990 },
    };

    return period === 'monthly' ? prices[plan].monthly : prices[plan].yearly;
  },
};

export default licensePaymentsService;
