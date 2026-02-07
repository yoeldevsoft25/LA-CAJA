import { api } from '../runtime/api';
import {
    PaymentMethod,
    PaymentMethodConfig,
    CreatePaymentMethodConfigRequest,
    CashMovement,
    CreateCashMovementRequest,
    CashMovementsResponse,
    CashMovementsSummary
} from '../types/payments.types';

export const paymentsService = {
    async upsertPaymentMethodConfig(
        method: PaymentMethod,
        data: CreatePaymentMethodConfigRequest
    ): Promise<PaymentMethodConfig> {
        const response = await api.put<PaymentMethodConfig>(`/payments/methods/${method}`, data);
        return response.data;
    },

    async getPaymentMethodConfigs(): Promise<PaymentMethodConfig[]> {
        const response = await api.get<PaymentMethodConfig[]>('/payments/methods');
        return response.data;
    },

    async getPaymentMethodConfig(method: PaymentMethod): Promise<PaymentMethodConfig | null> {
        const response = await api.get<PaymentMethodConfig | null>(`/payments/methods/${method}`);
        return response.data;
    },

    async deletePaymentMethodConfig(method: PaymentMethod): Promise<void> {
        await api.delete(`/payments/methods/${method}`);
    },

    async createCashMovement(data: CreateCashMovementRequest): Promise<CashMovement> {
        const response = await api.post<CashMovement>('/payments/movements', data);
        return response.data;
    },

    async getCashMovements(params?: {
        limit?: number;
        offset?: number;
        shift_id?: string;
        cash_session_id?: string;
    }): Promise<CashMovementsResponse> {
        const response = await api.get<CashMovementsResponse>('/payments/movements', { params });
        return response.data;
    },

    async getCashMovementsSummary(params?: {
        shift_id?: string;
        cash_session_id?: string;
    }): Promise<CashMovementsSummary> {
        const response = await api.get<CashMovementsSummary>('/payments/movements/summary', { params });
        return response.data;
    },
};
