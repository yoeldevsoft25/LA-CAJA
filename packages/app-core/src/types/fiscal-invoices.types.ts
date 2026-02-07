export type FiscalInvoiceType = 'invoice' | 'credit_note' | 'debit_note';
export type FiscalInvoiceStatus = 'draft' | 'issued' | 'cancelled' | 'rejected';

export interface FiscalInvoice {
    id: string;
    store_id: string;
    sale_id?: string | null;
    invoice_number: string;
    fiscal_number?: string | null;
    invoice_series_id?: string | null;
    invoice_type: FiscalInvoiceType;
    status: FiscalInvoiceStatus;
    issued_at?: string | null;
    cancelled_at?: string | null;
    issuer_name: string;
    issuer_tax_id: string;
    issuer_address?: string | null;
    issuer_phone?: string | null;
    issuer_email?: string | null;
    customer_id?: string | null;
    customer_name: string;
    customer_tax_id?: string | null;
    customer_address?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    subtotal_bs: number;
    subtotal_usd: number;
    tax_amount_bs: number;
    tax_amount_usd: number;
    tax_rate: number;
    discount_bs: number;
    discount_usd: number;
    total_bs: number;
    total_usd: number;
    exchange_rate: number;
    currency: 'BS' | 'USD' | 'MIXED';
    fiscal_control_code?: string | null;
    fiscal_authorization_number?: string | null;
    fiscal_qr_code?: string | null;
    payment_method?: string | null;
    note?: string | null;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
    items?: FiscalInvoiceItem[];
    sale?: {
        id: string;
        invoice_full_number?: string | null;
    };
    customer?: {
        id: string;
        name: string;
    };
    invoice_series?: {
        id: string;
        series_code: string;
        name: string;
    };
}

export interface FiscalInvoiceItem {
    id: string;
    fiscal_invoice_id: string;
    product_id: string;
    variant_id?: string | null;
    product_name: string;
    product_code?: string | null;
    quantity: number;
    unit_price_bs: number;
    unit_price_usd: number;
    discount_bs: number;
    discount_usd: number;
    subtotal_bs: number;
    subtotal_usd: number;
    tax_amount_bs: number;
    tax_amount_usd: number;
    total_bs: number;
    total_usd: number;
    tax_rate: number;
    note?: string | null;
    created_at: string;
}

export interface CreateFiscalInvoiceItem {
    product_id: string;
    variant_id?: string;
    quantity: number;
    unit_price_bs: number;
    unit_price_usd: number;
    discount_bs?: number;
    discount_usd?: number;
    tax_rate?: number;
}

export interface CreateFiscalInvoiceRequest {
    sale_id?: string;
    invoice_series_id?: string;
    invoice_type?: FiscalInvoiceType;
    customer_id?: string;
    customer_name?: string;
    customer_tax_id?: string;
    customer_address?: string;
    customer_phone?: string;
    customer_email?: string;
    items: CreateFiscalInvoiceItem[];
    tax_rate?: number;
    payment_method?: string;
    note?: string;
}

export interface FiscalInvoiceStatistics {
    total_invoices: number;
    issued_invoices: number;
    draft_invoices: number;
    cancelled_invoices: number;
    total_amount_bs: number;
    total_amount_usd: number;
    total_tax_bs: number;
    total_tax_usd: number;
    by_status: Record<string, number>;
}
