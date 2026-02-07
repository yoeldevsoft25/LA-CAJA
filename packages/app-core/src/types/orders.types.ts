export type { CreateSaleRequest } from './sales.types';

export type OrderStatus = 'open' | 'paused' | 'closed' | 'cancelled';

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    variant_id: string | null;
    qty: number;
    unit_price_bs: number | string;
    unit_price_usd: number | string;
    discount_bs: number | string;
    discount_usd: number | string;
    note: string | null;
    status?: 'pending' | 'preparing' | 'ready'; // Estado en cocina
    added_at: string;
    created_at: string;
    product?: {
        id: string;
        name: string;
        sku?: string | null;
        barcode?: string | null;
    } | null;
    variant?: {
        id: string;
        variant_type: string;
        variant_value: string;
    } | null;
}

export interface OrderPayment {
    id: string;
    order_id: string;
    sale_id: string | null;
    amount_bs: number | string;
    amount_usd: number | string;
    payment_method: string;
    paid_at: string;
    paid_by_user_id: string | null;
    note: string | null;
    created_at: string;
}

export interface Order {
    id: string;
    store_id: string;
    table_id: string | null;
    order_number: string;
    status: OrderStatus;
    opened_at: string;
    paused_at: string | null;
    closed_at: string | null;
    customer_id: string | null;
    opened_by_user_id: string | null;
    closed_by_user_id: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
    table?: {
        id: string;
        table_number: string;
        name: string | null;
    } | null;
    customer?: {
        id: string;
        name: string;
        document_id: string | null;
    } | null;
    items: OrderItem[];
    payments: OrderPayment[];
}

export interface CreateOrderRequest {
    table_id?: string | null;
    customer_id?: string | null;
    note?: string | null;
    items?: {
        product_id: string;
        variant_id?: string | null;
        qty: number;
        discount_bs?: number;
        discount_usd?: number;
        note?: string | null;
    }[];
}

export interface AddOrderItemRequest {
    product_id: string;
    variant_id?: string | null;
    qty: number;
    discount_bs?: number;
    discount_usd?: number;
    note?: string | null;
}

export interface CreatePartialPaymentRequest {
    amount_bs: number;
    amount_usd: number;
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'SPLIT';
    note?: string | null;
    customer_id?: string;
}

export interface MoveOrderRequest {
    table_id?: string | null;
}

export interface MergeOrdersRequest {
    order_ids: string[];
    target_order_id: string;
}
