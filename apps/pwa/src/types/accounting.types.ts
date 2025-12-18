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

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface ChartOfAccount {
  id: string
  store_id: string
  code: string
  name: string
  account_type: AccountType
  parent_id: string | null
  level: number
  is_detail: boolean
  status: AccountStatus
  description: string | null
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
  account_code: string
  account_name: string
  description: string | null
  debit_amount_bs: number | string
  credit_amount_bs: number | string
  debit_amount_usd: number | string
  credit_amount_usd: number | string
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
  source_entity_type: string | null
  source_entity_id: string | null
  created_at: string
  updated_at: string
  posted_at: string | null
  cancelled_at: string | null
  lines: EntryLine[]
}

export enum MappingTransactionType {
  SALE = 'sale',
  PURCHASE = 'purchase',
  FISCAL_INVOICE = 'fiscal_invoice',
  PAYMENT = 'payment',
  RECEIPT = 'receipt',
}

export interface AccountMapping {
  id: string
  store_id: string
  transaction_type: MappingTransactionType
  account_code: string
  account_name: string
  is_default: boolean
  conditions: Record<string, any> | null
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
  code: string
  name: string
  account_type: AccountType
  parent_id?: string | null
  description?: string | null
}

export interface UpdateAccountDto {
  name?: string
  description?: string | null
  status?: AccountStatus
}

export interface CreateEntryDto {
  entry_date: string
  entry_type: EntryType
  description: string
  lines: Array<{
    account_code: string
    description?: string | null
    debit_amount_bs?: number
    credit_amount_bs?: number
    debit_amount_usd?: number
    credit_amount_usd?: number
  }>
}

export interface CreateMappingDto {
  transaction_type: MappingTransactionType
  account_code: string
  is_default?: boolean
  conditions?: Record<string, any> | null
}

export interface UpdateMappingDto {
  account_code?: string
  is_default?: boolean
  conditions?: Record<string, any> | null
}

export interface CreateExportDto {
  format: ExportFormat
  standard?: AccountingStandard | null
  start_date: string
  end_date: string
}

