export interface SalesByDayReport {
    total_sales: number;
    total_amount_bs: number;
    total_amount_usd: number;
    total_cost_bs: number;
    total_cost_usd: number;
    total_profit_bs: number;
    total_profit_usd: number;
    profit_margin: number;
    by_payment_method: Record<string, { count: number; amount_bs: number; amount_usd: number }>;
    daily: Array<{
        date: string;
        sales_count: number;
        total_bs: number;
        total_usd: number;
        cost_bs: number;
        cost_usd: number;
        profit_bs: number;
        profit_usd: number;
    }>;
}

export interface TopProduct {
    product_id: string;
    product_name: string;
    quantity_sold: number;
    quantity_sold_kg: number;
    quantity_sold_units: number;
    revenue_bs: number;
    revenue_usd: number;
    cost_bs: number;
    cost_usd: number;
    profit_bs: number;
    profit_usd: number;
    profit_margin: number;
    is_weight_product: boolean;
    weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;
}

export interface DebtSummaryReport {
    total_debt_bs: number;
    total_debt_usd: number;
    total_paid_bs: number;
    total_paid_usd: number;
    total_pending_bs: number;
    total_pending_usd: number;
    by_status: {
        open: number;
        partial: number;
        paid: number;
    };
    top_debtors: Array<{
        customer_id: string;
        customer_name: string;
        total_debt_bs: number;
        total_debt_usd: number;
        total_paid_bs: number;
        total_paid_usd: number;
        pending_bs: number;
        pending_usd: number;
    }>;
}

export interface ReportDateRange {
    start_date?: string;
    end_date?: string;
}

export interface PurchasesBySupplierReport {
    total_orders: number;
    total_amount_bs: number;
    total_amount_usd: number;
    by_supplier: Array<{
        supplier_id: string;
        supplier_name: string;
        supplier_code: string | null;
        orders_count: number;
        total_amount_bs: number;
        total_amount_usd: number;
        completed_orders: number;
        pending_orders: number;
    }>;
}

export interface FiscalInvoicesReport {
    total_invoices: number;
    total_amount_bs: number;
    total_amount_usd: number;
    total_tax_bs: number;
    total_tax_usd: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    daily: Array<{
        date: string;
        invoices_count: number;
        total_bs: number;
        total_usd: number;
        tax_bs: number;
        tax_usd: number;
    }>;
}
