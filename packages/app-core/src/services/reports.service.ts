import { api } from '../runtime/api';
import {
    SalesByDayReport,
    TopProduct,
    DebtSummaryReport,
    ReportDateRange,
    PurchasesBySupplierReport,
    FiscalInvoicesReport,
} from '../types/reports.types';

export const reportsService = {
    /**
     * Reporte de ventas por día
     */
    async getSalesByDay(params?: ReportDateRange): Promise<SalesByDayReport> {
        const response = await api.get<SalesByDayReport>('/reports/sales/by-day', {
            params,
        });
        return response.data;
    },

    /**
     * Top productos más vendidos
     */
    async getTopProducts(limit = 10, params?: ReportDateRange): Promise<TopProduct[]> {
        const response = await api.get<TopProduct[]>('/reports/sales/top-products', {
            params: { limit, ...params },
        });
        return response.data;
    },

    /**
     * Resumen de deudas/FIAO
     */
    async getDebtSummary(): Promise<DebtSummaryReport> {
        const response = await api.get<DebtSummaryReport>('/reports/debts/summary');
        return response.data;
    },

    /**
     * Exportar ventas a CSV
     */
    async exportSalesCSV(params?: ReportDateRange): Promise<Blob> {
        const response = await api.get('/reports/sales/export/csv', {
            params,
            responseType: 'blob',
        });
        return response.data;
    },

    /**
     * Reporte de compras por proveedor
     */
    async getPurchasesBySupplier(params?: ReportDateRange): Promise<PurchasesBySupplierReport> {
        const response = await api.get<PurchasesBySupplierReport>('/reports/purchases/by-supplier', {
            params,
        });
        return response.data;
    },

    /**
     * Reporte de facturas fiscales emitidas
     */
    async getFiscalInvoicesReport(
        startDate?: string,
        endDate?: string,
        status?: string,
    ): Promise<FiscalInvoicesReport> {
        const params: any = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (status) params.status = status;
        const response = await api.get<FiscalInvoicesReport>(
            '/reports/fiscal-invoices',
            { params },
        );
        return response.data;
    },
};
