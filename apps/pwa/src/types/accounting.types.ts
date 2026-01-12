/**
 * Tipos TypeScript para el módulo contable
 */

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export interface ChartOfAccount {
  id: string
  store_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  parent_account_id: string | null
  level: number
  is_active: boolean
  allows_entries: boolean
  description: string | null
  metadata?: Record<string, any> | null // Metadatos adicionales
  created_at: string
  updated_at: string
  // Campos calculados
  parent?: ChartOfAccount | null
  children?: ChartOfAccount[]
}

export interface ChartOfAccountTree extends ChartOfAccount {
  children: ChartOfAccountTree[]
}

export enum EntryType {
  SALE = 'sale',
  PURCHASE = 'purchase',
  FISCAL_INVOICE = 'fiscal_invoice',
  MANUAL = 'manual',
  ADJUSTMENT = 'adjustment',
  CLOSING = 'closing',
}

export enum EntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  CANCELLED = 'cancelled',
}

export interface EntryLine {
  id: string
  entry_id: string
  account_id: string
  account_code: string
  account_name: string
  description: string | null
  debit_amount_bs: number | string
  credit_amount_bs: number | string
  debit_amount_usd: number | string
  credit_amount_usd: number | string
  cost_center?: string | null
  project_code?: string | null
  tax_code?: string | null
  metadata?: Record<string, any> | null
}

export interface AccountingEntry {
  id: string
  store_id: string
  entry_number: string
  entry_date: string
  entry_type: EntryType
  description: string
  total_debit_bs: number | string
  total_credit_bs: number | string
  total_debit_usd: number | string
  total_credit_usd: number | string
  status: EntryStatus
  source_type?: string | null // Tipo de fuente (sale, purchase, etc.)
  source_id?: string | null // ID de la entidad fuente
  reference_number?: string | null
  exchange_rate?: number | null
  currency?: 'BS' | 'USD' | 'MIXED' | null
  is_auto_generated?: boolean // Si fue generado automáticamente
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
  posted_at: string | null
  cancelled_at: string | null
  cancelled_reason?: string | null
  lines: EntryLine[]
}

export enum MappingTransactionType {
  SALE_REVENUE = 'sale_revenue',
  SALE_COST = 'sale_cost',
  SALE_TAX = 'sale_tax',
  PURCHASE_EXPENSE = 'purchase_expense',
  PURCHASE_TAX = 'purchase_tax',
  INVENTORY_ASSET = 'inventory_asset',
  CASH_ASSET = 'cash_asset',
  ACCOUNTS_RECEIVABLE = 'accounts_receivable',
  ACCOUNTS_PAYABLE = 'accounts_payable',
  EXPENSE = 'expense',
  INCOME = 'income',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
}

export interface AccountMapping {
  id: string
  store_id: string
  transaction_type: MappingTransactionType
  account_id: string
  account_code: string
  account_name?: string | null
  is_default: boolean
  conditions: Record<string, any> | null
  is_active?: boolean
  created_at: string
  updated_at: string
}

export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json',
  VIOTECH = 'viotech',
}

export enum AccountingStandard {
  IFRS = 'ifrs',
  NIIF = 'niif',
  LOCAL = 'local',
}

export interface AccountingExport {
  id: string
  store_id: string
  format: ExportFormat
  standard: AccountingStandard | null
  start_date: string
  end_date: string
  file_path: string | null
  file_size: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface AccountBalance {
  account_id: string
  account_code: string
  account_name: string
  opening_balance_bs: number | string
  opening_balance_usd: number | string
  total_debit_bs: number | string
  total_credit_bs: number | string
  total_debit_usd: number | string
  total_credit_usd: number | string
  closing_balance_bs: number | string
  closing_balance_usd: number | string
}

export interface CreateAccountDto {
  account_code: string
  account_name: string
  account_type: AccountType
  parent_account_id?: string | null
  level?: number // 1-5
  is_active?: boolean
  allows_entries?: boolean
  description?: string | null
  metadata?: Record<string, any>
}

export interface UpdateAccountDto {
  account_name?: string
  description?: string | null
  is_active?: boolean
  allows_entries?: boolean
}

export interface CreateEntryDto {
  entry_date: string
  entry_type: EntryType
  source_type?: string
  source_id?: string
  description: string
  reference_number?: string
  exchange_rate?: number
  currency?: 'BS' | 'USD' | 'MIXED'
  lines: Array<{
    account_id: string
    account_code: string
    account_name: string
    description?: string | null
    debit_amount_bs: number
    credit_amount_bs: number
    debit_amount_usd: number
    credit_amount_usd: number
    cost_center?: string
    project_code?: string
    tax_code?: string
    metadata?: Record<string, any>
  }>
  metadata?: Record<string, any>
}

export interface CreateMappingDto {
  transaction_type: MappingTransactionType
  account_id: string
  account_code: string
  is_default?: boolean
  conditions?: Record<string, any> | null
}

export interface UpdateMappingDto {
  account_id?: string
  account_code?: string
  is_default?: boolean
  conditions?: Record<string, any> | null
}

export interface CreateExportDto {
  export_type: ExportFormat // Cambiado de 'format' a 'export_type'
  format_standard?: AccountingStandard | null // Cambiado de 'standard' a 'format_standard'
  start_date: string
  end_date: string
  entry_types?: string[]
  account_codes?: string[]
}

// Tipos para reportes
export interface BalanceSheetAccount {
  account_code: string
  account_name: string
  balance_bs: number
  balance_usd: number
}

export interface BalanceSheetReport {
  assets: BalanceSheetAccount[]
  liabilities: BalanceSheetAccount[]
  equity: BalanceSheetAccount[]
  totals: {
    total_assets_bs: number
    total_assets_usd: number
    total_liabilities_bs: number
    total_liabilities_usd: number
    total_equity_bs: number
    total_equity_usd: number
  }
}

export interface IncomeStatementAccount {
  account_code: string
  account_name: string
  amount_bs: number
  amount_usd: number
}

export interface IncomeStatementReport {
  revenues: IncomeStatementAccount[]
  expenses: IncomeStatementAccount[]
  totals: {
    total_revenue_bs: number
    total_revenue_usd: number
    total_expenses_bs: number
    total_expenses_usd: number
    net_income_bs: number
    net_income_usd: number
  }
}
