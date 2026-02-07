import { api } from '../runtime/api';
import {
    DiscountConfig,
    CreateDiscountConfigRequest,
    DiscountAuthorization,
    AuthorizeDiscountRequest,
    DiscountAuthorizationsResponse,
    DiscountSummary
} from '../types/discounts.types';

export const discountsService = {
    async upsertDiscountConfig(data: CreateDiscountConfigRequest): Promise<DiscountConfig> {
        const response = await api.put<DiscountConfig>('/discounts/config', data);
        return response.data;
    },

    async getDiscountConfig(): Promise<DiscountConfig | null> {
        const response = await api.get<DiscountConfig | null>('/discounts/config');
        return response.data;
    },

    async authorizeDiscount(data: AuthorizeDiscountRequest): Promise<DiscountAuthorization> {
        const response = await api.post<DiscountAuthorization>('/discounts/authorize', data);
        return response.data;
    },

    async getAuthorizationsBySale(saleId: string): Promise<DiscountAuthorization[]> {
        const response = await api.get<DiscountAuthorization[]>(`/discounts/authorizations/sale/${saleId}`);
        return response.data;
    },

    async getAuthorizations(params?: {
        limit?: number;
        offset?: number;
        start_date?: string;
        end_date?: string;
    }): Promise<DiscountAuthorizationsResponse> {
        const response = await api.get<DiscountAuthorizationsResponse>('/discounts/authorizations', { params });
        return response.data;
    },

    async getDiscountSummary(params?: {
        start_date?: string;
        end_date?: string;
    }): Promise<DiscountSummary> {
        const response = await api.get<DiscountSummary>('/discounts/summary', { params });
        return response.data;
    },
};
