import { api } from '../runtime/api';
import {
    FiscalInvoice,
    FiscalInvoiceStatus,
    CreateFiscalInvoiceRequest,
    FiscalInvoiceStatistics,
} from '../types/fiscal-invoices.types';

export const fiscalInvoicesService = {
    /**
     * Crea una factura fiscal independiente
     */
    async create(data: CreateFiscalInvoiceRequest): Promise<FiscalInvoice> {
        const response = await api.post<FiscalInvoice>('/fiscal-invoices', data);
        return response.data;
    },

    /**
     * Crea una factura fiscal desde una venta
     */
    async createFromSale(saleId: string): Promise<FiscalInvoice> {
        const response = await api.post<FiscalInvoice>(
            `/fiscal-invoices/from-sale/${saleId}`,
        );
        return response.data;
    },

    /**
     * Obtiene todas las facturas fiscales
     */
    async findAll(status?: FiscalInvoiceStatus): Promise<FiscalInvoice[]> {
        const params: any = {};
        if (status) params.status = status;
        const response = await api.get<FiscalInvoice[]>('/fiscal-invoices', {
            params,
        });
        return response.data;
    },

    /**
     * Obtiene una factura fiscal por ID
     */
    async findOne(id: string): Promise<FiscalInvoice> {
        const response = await api.get<FiscalInvoice>(`/fiscal-invoices/${id}`);
        return response.data;
    },

    /**
     * Obtiene la factura fiscal de una venta (si existe)
     */
    async findBySale(saleId: string): Promise<FiscalInvoice | null> {
        try {
            const response = await api.get<FiscalInvoice>(
                `/fiscal-invoices/by-sale/${saleId}`,
            );
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    },

    /**
     * Obtiene todas las facturas fiscales asociadas a una venta
     */
    async findAllBySale(saleId: string): Promise<FiscalInvoice[]> {
        try {
            const response = await api.get<FiscalInvoice[]>(
                `/fiscal-invoices/all-by-sale/${saleId}`,
            );
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return [];
            }
            throw error;
        }
    },

    /**
     * Obtiene estadísticas de facturas fiscales
     */
    async getStatistics(
        startDate?: string,
        endDate?: string,
    ): Promise<FiscalInvoiceStatistics> {
        const params: any = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        const response = await api.get<FiscalInvoiceStatistics>(
            '/fiscal-invoices/statistics',
            { params },
        );
        return response.data;
    },

    /**
     * Emite una factura fiscal (cambia de draft a issued)
     */
    async issue(id: string): Promise<FiscalInvoice> {
        const response = await api.put<FiscalInvoice>(`/fiscal-invoices/${id}/issue`);
        return response.data;
    },

    /**
     * Cancela una factura fiscal (solo borradores)
     */
    async cancel(id: string): Promise<FiscalInvoice> {
        const response = await api.put<FiscalInvoice>(
            `/fiscal-invoices/${id}/cancel`,
        );
        return response.data;
    },

    /**
     * Crea una nota de crédito que anula una factura emitida
     */
    async createCreditNote(
        invoiceId: string,
        body?: { reason?: string },
    ): Promise<FiscalInvoice> {
        const response = await api.post<FiscalInvoice>(
            `/fiscal-invoices/${invoiceId}/credit-note`,
            body ?? {},
        );
        return response.data;
    },
};
