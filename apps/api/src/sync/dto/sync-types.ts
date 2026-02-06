export interface SaleItemPayload {
  item_id?: string;
  product_id: string;
  variant_id?: string | null;
  lot_id?: string | null;
  qty: number | string;
  unit_price_bs: number | string;
  unit_price_usd: number | string;
  discount_bs?: number | string;
  discount_usd?: number | string;
  is_weight_product?: boolean | number | string; // boolean, 0/1 or string
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;
  weight_value?: number | string | null;
  price_per_weight_bs?: number | string | null;
  price_per_weight_usd?: number | string | null;
}

export interface SaleTotalsPayload {
  total_bs?: number | string;
  total_usd?: number | string;
  subtotal_bs?: number | string;
  subtotal_usd?: number | string;
  discount_total_bs?: number | string;
  discount_total_usd?: number | string;
}

export interface SalePaymentPayload {
  method: string; // 'CASH', 'ZELLE', 'CARD', 'FIAO', etc.
  amount_bs?: number | string;
  amount_usd?: number | string;
  reference?: string;
}

export interface SaleCreatedPayload {
  sale_id: string;
  warehouse_id?: string | null;
  cash_session_id?: string | null;
  sold_at?: string | Date; // ISO string
  exchange_rate?: number | string;
  currency?: 'BS' | 'USD' | 'MIXED';
  totals?: SaleTotalsPayload;
  payment?: SalePaymentPayload;
  customer_id?: string | null;
  customer?: {
    customer_id: string;
  };
  note?: string | null;
  generate_fiscal_invoice?: boolean;
  items: SaleItemPayload[];
}

export interface CashSessionOpenedPayload {
  session_id: string;
  opened_at?: string | Date;
  opening_amount_bs?: number | string;
  opening_amount_usd?: number | string;
  note?: string | null;
}

export interface CashSessionClosedPayload {
  session_id: string;
  closed_at?: string | Date;
  expected?: Record<string, number>; // currency -> amount
  counted?: Record<string, number>; // currency -> amount
  note?: string | null;
}

export interface CustomerCreatedPayload {
  customer_id: string;
  name: string;
  phone?: string | null;
  note?: string | null;
}

export interface CustomerUpdatedPayload {
  customer_id: string;
  patch: {
    name?: string;
    phone?: string | null;
    note?: string | null;
  };
}

export interface StockAdjustedPayload {
  movement_id: string;
  product_id: string;
  variant_id?: string | null;
  warehouse_id?: string | null;
  qty_delta: number | string;
  note?: string | null;
}

export interface ProductCreatedPayload {
  product_id: string;
  name: string;
  category?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price_bs?: number | string;
  price_usd?: number | string;
  cost_bs?: number | string;
  cost_usd?: number | string;
  is_active?: boolean;
  low_stock_threshold?: number | string;
  description?: string | null;
  image_url?: string | null;
  is_recipe?: boolean | number;
  profit_margin?: number | string;
  product_type?: 'prepared' | 'sale_item' | 'ingredient';
  is_visible_public?: boolean;
  public_name?: string | null;
  public_description?: string | null;
  public_image_url?: string | null;
  public_category?: string | null;
}

export interface ProductUpdatedPayload {
  product_id: string;
  patch: {
    name?: string;
    category?: string | null;
    sku?: string | null;
    barcode?: string | null;
    low_stock_threshold?: number | string;
    description?: string | null;
    image_url?: string | null;
    is_recipe?: boolean | number;
    profit_margin?: number | string;
    product_type?: 'prepared' | 'sale_item' | 'ingredient';
    is_visible_public?: boolean;
    public_name?: string | null;
    public_description?: string | null;
    public_image_url?: string | null;
    public_category?: string | null;
  };
}

export interface ProductDeactivatedPayload {
  product_id: string;
}

export interface PriceChangedPayload {
  product_id: string;
  price_bs?: number | string;
  price_usd?: number | string;
}

export interface StockReceivedPayload {
  movement_id: string;
  product_id: string;
  variant_id?: string | null;
  warehouse_id?: string | null;
  qty: number | string;
  unit_cost_bs?: number | string;
  unit_cost_usd?: number | string;
  note?: string | null;
  ref?: Record<string, unknown> | null;
}

export interface RecipeIngredientsUpdatedPayload {
  product_id: string;
  ingredients: Array<{
    ingredient_product_id: string;
    qty: number | string;
    unit?: string | null;
  }>;
}

export interface DebtCreatedPayload {
  debt_id: string;
  sale_id?: string | null;
  customer_id: string;
  created_at?: string | Date;
  amount_bs?: number | string;
  amount_usd?: number | string;
  note?: string | null;
}

export interface DebtPaymentRecordedPayload {
  payment_id: string;
  debt_id: string;
  amount_bs?: number | string;
  amount_usd?: number | string;
  method: string;
  reference?: string | null;
  paid_at?: string | Date; // ISO string
  note?: string | null;
}

export interface CashLedgerEntryCreatedPayload {
  entry_id: string;
  request_id: string;
  entry_type:
    | 'sale'
    | 'expense'
    | 'adjustment'
    | 'transfer'
    | 'initial_balance'
    | 'income';
  amount_bs: number | string;
  amount_usd: number | string;
  currency: 'BS' | 'USD' | 'MIXED';
  cash_session_id: string;
  sold_at: number | string | Date;
  metadata?: Record<string, any>;
}

export interface StockDeltaAppliedPayload {
  movement_id: string;
  product_id: string;
  warehouse_id?: string;
  qty_delta: number | string;
  reason: string;
  ref?: Record<string, any>;
  request_id: string;
  unit_cost_bs?: number | string;
  unit_cost_usd?: number | string;
  variant_id?: string | null;
  from_escrow?: boolean;
}

export interface StockQuotaGrantedPayload {
  quota_id: string;
  product_id: string;
  device_id: string;
  qty_granted: number | string;
  expires_at?: number | string | Date;
  request_id: string;
  variant_id?: string | null;
}

export interface StockQuotaTransferredPayload {
  from_device_id: string;
  to_device_id: string;
  product_id: string;
  qty: number | string;
  request_id: string;
  variant_id?: string | null;
}

export interface StockQuotaReclaimedPayload {
  product_id: string;
  device_id: string;
  qty_reclaimed: number | string;
  request_id: string;
  variant_id?: string | null;
  reason?: string;
}
