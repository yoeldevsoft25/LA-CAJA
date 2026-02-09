export interface CartItemDto {
    product_id: string;
    qty: number;
    discount_bs?: number;
    discount_usd?: number;
    variant_id?: string | null;
    is_weight_product?: boolean;
    weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;
    weight_value?: number | null;
    price_per_weight_bs?: number | null;
    price_per_weight_usd?: number | null;
}

export interface SplitPaymentDto {
    method: string;
    amount_usd?: number;
    amount_bs?: number;
    reference?: string;
    bank_code?: string;
    phone?: string;
    card_last_4?: string;
    note?: string;
}

export interface CreateSaleRequest {
    items: CartItemDto[];
    exchange_rate: number;
    currency: 'BS' | 'USD' | 'MIXED';
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'SPLIT' | 'FIAO';
    split?: {
        cash_bs?: number;
        cash_usd?: number;
        pago_movil_bs?: number;
        transfer_bs?: number;
        other_bs?: number;
    };
    split_payments?: SplitPaymentDto[];
    cash_payment?: {
        received_usd: number;
        change_bs?: number;
        change_rounding?: {
            mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT';
            exact_change_bs: number;
            rounded_change_bs: number;
            adjustment_bs: number;
            consented?: boolean;
        };
    };
    cash_payment_bs?: {
        received_bs: number;
        change_bs?: number;
        change_rounding?: {
            mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT';
            exact_change_bs: number;
            rounded_change_bs: number;
            adjustment_bs: number;
            consented?: boolean;
        };
    };
    customer_id?: string;
    customer_name?: string;
    customer_document_id?: string;
    customer_phone?: string;
    customer_note?: string;
    cash_session_id?: string;
    note?: string | null;
    invoice_series_id?: string | null;
    invoice_number?: string | null;
    fiscal_number?: string | number | null;
    price_list_id?: string | null;
    promotion_id?: string | null;
    warehouse_id?: string | null;
    generate_fiscal_invoice?: boolean;
    request_id?: string;
    device_id?: string;
    store_id?: string;
    user_id?: string;
    user_role?: 'owner' | 'cashier';
    skip_stock_validation?: boolean;
}

export interface SaleItem {
    id: string;
    product_id: string;
    qty: number;
    unit_price_bs: number | string;
    unit_price_usd: number | string;
    discount_bs: number | string;
    discount_usd: number | string;
    is_weight_product?: boolean;
    weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;
    weight_value?: number | null;
    price_per_weight_bs?: number | null;
    price_per_weight_usd?: number | null;
    product?: {
        id: string;
        name: string;
        sku?: string | null;
        barcode?: string | null;
    };
}

export interface Sale {
    id: string;
    store_id: string;
    cash_session_id: string | null;
    customer_id: string | null;
    sold_by_user_id: string | null;
    voided_at?: string | null;
    voided_by_user_id?: string | null;
    void_reason?: string | null;
    sold_by_user?: {
        id: string;
        full_name: string | null;
    } | null;
    customer?: {
        id: string;
        name: string;
        document_id: string | null;
        phone: string | null;
    } | null;
    debt?: {
        id: string;
        status: 'open' | 'partial' | 'paid';
        amount_bs: number | string;
        amount_usd: number | string;
        total_paid_bs?: number;
        total_paid_usd?: number;
        remaining_bs?: number;
        remaining_usd?: number;
    } | null;
    exchange_rate: number | string;
    currency: 'BS' | 'USD' | 'MIXED';
    sync_status?: 'pending' | 'synced' | 'failed' | 'conflict';
    totals: {
        subtotal_bs: number | string;
        subtotal_usd: number | string;
        discount_bs: number | string;
        discount_usd: number | string;
        total_bs: number | string;
        total_usd: number | string;
    };
    sold_at: string;
    items: SaleItem[];
    payment: {
        method: string;
        split?: {
            cash_bs?: number;
            cash_usd?: number;
            pago_movil_bs?: number;
            transfer_bs?: number;
            other_bs?: number;
        };
        split_payments?: SplitPaymentDto[];
        cash_payment?: {
            received_usd: number;
            change_bs?: number;
        };
        cash_payment_bs?: {
            received_bs: number;
            change_bs?: number;
        };
    };
    note: string | null;
    invoice_series_id?: string | null;
    invoice_number?: string | null;
    fiscal_number?: string | null;
    invoice_full_number?: string | null;
    fiscal_invoice?: {
        id: string;
        invoice_number: string;
        fiscal_number?: string | null;
        status: 'draft' | 'issued' | 'cancelled' | 'rejected';
        issued_at?: string | null;
    } | null;
}

export interface ReturnSaleItemDto {
    sale_item_id: string;
    qty: number;
    note?: string;
    serial_ids?: string[];
}

export interface SaleReturn {
    id: string;
    store_id: string;
    sale_id: string;
    created_by: string | null;
    created_at: string;
    reason: string | null;
    total_bs: number;
    total_usd: number;
    items: SaleReturnItem[];
}

export interface SaleReturnItem {
    id: string;
    return_id: string;
    sale_item_id: string;
    qty: number;
    unit_price_bs: number;
    unit_price_usd: number;
    subtotal_bs: number;
    subtotal_usd: number;
    note: string | null;
}
