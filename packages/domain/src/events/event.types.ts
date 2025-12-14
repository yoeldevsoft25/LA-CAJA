/**
 * Tipos de eventos del sistema
 * Versión 1 - MVP
 */

export type StoreRole = 'owner' | 'cashier';
export type Currency = 'BS' | 'USD' | 'MIXED';
export type PaymentMethod = 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'SPLIT' | 'FIAO';

export interface EventActor {
  user_id: string;
  role: StoreRole;
}

export interface BaseEvent {
  event_id: string;
  store_id: string;
  device_id: string;
  seq: number;
  type: string;
  version: number;
  created_at: number;
  actor: EventActor;
  payload: Record<string, any>;
}

// Product Events
export interface ProductCreatedPayload {
  product_id: string;
  name: string;
  category?: string;
  sku?: string;
  barcode?: string;
  price_bs: number;
  price_usd: number;
  cost_bs: number;
  cost_usd: number;
  is_active: boolean;
  low_stock_threshold: number;
}

export interface ProductUpdatedPayload {
  product_id: string;
  patch: Partial<{
    name: string;
    category: string;
    sku: string;
    barcode: string;
    low_stock_threshold: number;
  }>;
}

export interface ProductDeactivatedPayload {
  product_id: string;
  is_active: false;
}

export interface PriceChangedPayload {
  product_id: string;
  price_bs: number;
  price_usd: number;
  reason: 'manual' | 'bulk' | 'supplier';
  rounding: 'none' | '0.1' | '0.5' | '1';
  effective_at: number;
}

// Inventory Events
export interface StockReceivedPayload {
  movement_id: string;
  product_id: string;
  qty: number;
  unit_cost_bs: number;
  unit_cost_usd: number;
  note?: string;
  ref?: {
    supplier?: string;
    invoice?: string;
  };
}

export interface StockAdjustedPayload {
  movement_id: string;
  product_id: string;
  qty_delta: number;
  reason: 'loss' | 'damage' | 'count' | 'other';
  note?: string;
}

// Cash Events
export interface CashSessionOpenedPayload {
  cash_session_id: string;
  opened_at: number;
  opening_amount_bs: number;
  opening_amount_usd: number;
  note?: string;
}

export interface CashSessionClosedPayload {
  cash_session_id: string;
  closed_at: number;
  expected: {
    cash_bs: number;
    cash_usd: number;
    pago_movil_bs: number;
    transfer_bs: number;
    other_bs: number;
  };
  counted: {
    cash_bs: number;
    cash_usd: number;
    pago_movil_bs: number;
    transfer_bs: number;
    other_bs: number;
  };
  note?: string;
}

// Sale Events
export interface SaleItem {
  line_id: string;
  product_id: string;
  qty: number;
  unit_price_bs: number;
  unit_price_usd: number;
  discount_bs: number;
  discount_usd: number;
}

export interface SaleCreatedPayload {
  sale_id: string;
  cash_session_id: string;
  sold_at: number;
  exchange_rate: number;
  currency: Currency;
  items: SaleItem[];
  totals: {
    subtotal_bs: number;
    subtotal_usd: number;
    discount_bs: number;
    discount_usd: number;
    total_bs: number;
    total_usd: number;
  };
  payment: {
    method: PaymentMethod;
    split?: {
      cash_bs: number;
      cash_usd: number;
      pago_movil_bs: number;
      transfer_bs: number;
      other_bs: number;
    };
  };
  customer?: {
    customer_id: string | null;
  };
  note?: string;
}

// Customer & Debt Events
export interface CustomerCreatedPayload {
  customer_id: string;
  name: string;
  phone?: string;
  note?: string;
}

export interface CustomerUpdatedPayload {
  customer_id: string;
  patch: Partial<{
    name: string;
    phone: string;
    note: string;
  }>;
}

export interface DebtCreatedPayload {
  debt_id: string;
  sale_id: string;
  customer_id: string;
  created_at: number;
  amount_bs: number;
  amount_usd: number;
  note?: string;
}

export interface DebtPaymentRecordedPayload {
  payment_id: string;
  debt_id: string;
  paid_at: number;
  amount_bs: number;
  amount_usd: number;
  method: Exclude<PaymentMethod, 'SPLIT' | 'FIAO'>;
  note?: string;
}


