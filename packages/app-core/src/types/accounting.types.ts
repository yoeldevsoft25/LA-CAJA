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
    metadata?: Record<string, any> | null
    created_at: string
    updated_at: string
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
    source_type?: string | null
    source_id?: string | null
    reference_number?: string | null
    exchange_rate?: number | null
    currency?: 'BS' | 'USD' | 'MIXED' | null
    is_auto_generated?: boolean
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
    FX_GAIN_REALIZED = 'fx_gain_realized',
    FX_LOSS_REALIZED = 'fx_loss_realized',
    FX_GAIN_UNREALIZED = 'fx_gain_unrealized',
    FX_LOSS_UNREALIZED = 'fx_loss_unrealized',
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
    level?: number
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
    export_type: ExportFormat
    format_standard?: AccountingStandard | null
    start_date: string
    end_date: string
    entry_types?: string[]
    account_codes?: string[]
}

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

export interface TrialBalanceAccount {
    account_code: string
    account_name: string
    account_type: string
    debit_balance_bs: number
    credit_balance_bs: number
    debit_balance_usd: number
    credit_balance_usd: number
}

export interface TrialBalanceReport {
    accounts: TrialBalanceAccount[]
    totals: {
        total_debits_bs: number
        total_credits_bs: number
        total_debits_usd: number
        total_credits_usd: number
        is_balanced: boolean
        difference_bs: number
        difference_usd: number
    }
    unposted_entries_count: number
}

export interface GeneralLedgerMovement {
    entry_id: string
    entry_number: string
    entry_date: string
    description: string
    reference_number: string | null
    debit_amount_bs: number
    credit_amount_bs: number
    debit_amount_usd: number
    credit_amount_usd: number
    running_balance_bs: number
    running_balance_usd: number
}

export interface GeneralLedgerAccount {
    account_id: string
    account_code: string
    account_name: string
    account_type: string
    opening_balance_bs: number
    opening_balance_usd: number
    movements: GeneralLedgerMovement[]
    closing_balance_bs: number
    closing_balance_usd: number
    total_debits_bs: number
    total_credits_bs: number
    total_debits_usd: number
    total_credits_usd: number
}

export interface GeneralLedgerReport {
    accounts: GeneralLedgerAccount[]
}

export interface CashFlowAdjustment {
    description: string
    amount_bs: number
    amount_usd: number
}

export interface CashFlowWorkingCapital {
    accounts_receivable_bs: number
    accounts_receivable_usd: number
    accounts_payable_bs: number
    accounts_payable_usd: number
    inventory_bs: number
    inventory_usd: number
}

export interface CashFlowOperatingActivities {
    net_income_bs: number
    net_income_usd: number
    adjustments: CashFlowAdjustment[]
    changes_in_working_capital: CashFlowWorkingCapital
    net_cash_from_operations_bs: number
    net_cash_from_operations_usd: number
}

export interface CashFlowActivity {
    description: string
    amount_bs: number
    amount_usd: number
}

export interface CashFlowReport {
    operating_activities: CashFlowOperatingActivities
    investing_activities: CashFlowActivity[]
    financing_activities: CashFlowActivity[]
    net_change_in_cash_bs: number
    net_change_in_cash_usd: number
    cash_at_beginning_bs: number
    cash_at_beginning_usd: number
    cash_at_end_bs: number
    cash_at_end_usd: number
}

export interface AccountingValidationError {
    type: string
    severity: 'error' | 'warning'
    message: string
    details?: any
}

export interface AccountingValidationWarning {
    type: string
    message: string
    details?: any
}

export interface AccountingValidationResult {
    is_valid: boolean
    errors: AccountingValidationError[]
    warnings: AccountingValidationWarning[]
}

export interface AccountingReconciliationDiscrepancy {
    account_id: string
    account_code: string
    account_name: string
    expected_balance_bs: number
    actual_balance_bs: number
    difference_bs: number
    expected_balance_usd: number
    actual_balance_usd: number
    difference_usd: number
}

export interface AccountingReconciliationSummary {
    total_accounts: number
    reconciled_accounts: number
    accounts_with_discrepancies: number
}

export interface AccountingReconciliationResult {
    reconciled: number
    discrepancies: AccountingReconciliationDiscrepancy[]
    summary: AccountingReconciliationSummary
}

export interface AgingReportCustomer {
    customer_id: string
    customer_name: string
    current_bs: number
    current_usd: number
    days_1_30_bs: number
    days_1_30_usd: number
    days_31_60_bs: number
    days_31_60_usd: number
    days_61_90_bs: number
    days_61_90_usd: number
    days_over_90_bs: number
    days_over_90_usd: number
    total_bs: number
    total_usd: number
}

export interface AgingReportTotals {
    current_bs: number
    current_usd: number
    days_1_30_bs: number
    days_1_30_usd: number
    days_31_60_bs: number
    days_31_60_usd: number
    days_61_90_bs: number
    days_61_90_usd: number
    days_over_90_bs: number
    days_over_90_usd: number
    total_bs: number
    total_usd: number
}

export interface AccountsReceivableAgingReport {
    customers: AgingReportCustomer[]
    totals: AgingReportTotals
}

export interface AgingReportSupplier {
    supplier_id: string
    supplier_name: string
    current_bs: number
    current_usd: number
    days_1_30_bs: number
    days_1_30_usd: number
    days_31_60_bs: number
    days_31_60_usd: number
    days_61_90_bs: number
    days_61_90_usd: number
    days_over_90_bs: number
    days_over_90_usd: number
    total_bs: number
    total_usd: number
}

export interface AccountsPayableAgingReport {
    suppliers: AgingReportSupplier[]
    totals: AgingReportTotals
}

export interface AccountingBudgetLine {
    id: string
    budget_id: string
    account_id: string
    account_code?: string
    account_name?: string
    amount_bs: number
    amount_usd: number
    notes?: string
    created_at: string
    updated_at: string
}

export interface AccountingBudget {
    id: string
    store_id: string
    name: string
    description?: string
    period_start: string
    period_end: string
    status: 'draft' | 'active' | 'archived'
    total_amount_bs: number
    total_amount_usd: number
    created_by?: string
    lines?: AccountingBudgetLine[]
    created_at: string
    updated_at: string
}

export interface BudgetComparisonLine {
    account_id: string
    account_code: string
    account_name: string
    budget_bs: number
    actual_bs: number
    variance_bs: number
    variance_percent_bs: number
    budget_usd: number
    actual_usd: number
    variance_usd: number;
    variance_percent_usd: number;
}

export interface BudgetVsActualsReport {
    budget: AccountingBudget
    comparison: BudgetComparisonLine[]
}

export interface BankStatement {
    id: string
    store_id: string
    bank_name: string
    account_number: string
    period_start: string
    period_end: string
    currency: 'BS' | 'USD'
    total_debits: number
    total_credits: number
    starting_balance: number
    ending_balance: number
    status: 'draft' | 'pending' | 'reconciled'
    filename?: string
    created_by?: string
    lines?: BankTransaction[]
    created_at: string
    updated_at: string
}

export interface BankTransaction {
    id: string
    bank_statement_id: string
    transaction_date: string
    description: string
    reference_number?: string
    amount: number
    type: 'debit' | 'credit'
    balance_after?: number
    is_reconciled: boolean
    matched_entry_id?: string
    reconciliation_notes?: string
    metadata?: Record<string, any>
}

export interface AccountingAuditLog {
    id: string
    store_id: string
    user_id: string
    action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'post' | 'cancel'
    entity_type: string
    entity_id: string
    before_value?: Record<string, any>
    after_value?: Record<string, any>
    metadata?: Record<string, any>
    created_at: string
}
