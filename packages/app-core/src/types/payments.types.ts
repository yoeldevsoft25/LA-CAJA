import { PaymentMethod } from './split-payment.types';
export type { PaymentMethod };

export interface PaymentMethodConfig {
    id: string;
    store_id: string;
    method: PaymentMethod;
    min_amount_bs: number | null;
    min_amount_usd: number | null;
    max_amount_bs: number | null;
    max_amount_usd: number | null;
    enabled: boolean;
    requires_authorization: boolean;
    sort_order?: number | null;
    commission_percentage?: number | null;
    created_at: string;
    updated_at: string;
}

export interface CreatePaymentMethodConfigRequest {
    method: PaymentMethod;
    min_amount_bs?: number | null;
    min_amount_usd?: number | null;
    max_amount_bs?: number | null;
    max_amount_usd?: number | null;
    enabled?: boolean;
    requires_authorization?: boolean;
    sort_order?: number | null;
    commission_percentage?: number | null;
}

export interface CashMovement {
    id: string;
    store_id: string;
    shift_id: string | null;
    cash_session_id: string | null;
    movement_type: 'entry' | 'exit';
    amount_bs: number | string;
    amount_usd: number | string;
    reason: string;
    note: string | null;
    created_by: string;
    created_at: string;
}

export interface CreateCashMovementRequest {
    movement_type: 'entry' | 'exit';
    amount_bs: number;
    amount_usd: number;
    reason: string;
    shift_id?: string | null;
    cash_session_id?: string | null;
    note?: string | null;
}

export interface CashMovementsResponse {
    movements: CashMovement[];
    total: number;
}

export interface CashMovementsSummary {
    entries_bs: number;
    entries_usd: number;
    exits_bs: number;
    exits_usd: number;
    net_bs: number;
    net_usd: number;
    total_movements: number;
}
