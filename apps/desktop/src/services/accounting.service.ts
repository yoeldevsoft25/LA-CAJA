import { api } from '@/lib/api'
import type {
  ChartOfAccount,
  ChartOfAccountTree,
  AccountingEntry,
  AccountMapping,
  AccountingExport,
  AccountBalance,
  CreateAccountDto,
  UpdateAccountDto,
  CreateEntryDto,
  CreateMappingDto,
  UpdateMappingDto,
  CreateExportDto,
  EntryType,
  EntryStatus,
  BalanceSheetReport,
  IncomeStatementReport,
  TrialBalanceReport,
  GeneralLedgerReport,
  CashFlowReport,
  AccountingValidationResult,
  AccountingReconciliationResult,
} from '@/types/accounting.types'

/**
 * Servicio para el Plan de Cuentas
 */
export const chartOfAccountsService = {
  /**
   * Obtiene todas las cuentas
   */
  async getAll(params?: { active_only?: boolean }): Promise<ChartOfAccount[]> {
    const response = await api.get<ChartOfAccount[]>('/accounting/accounts', { params })
    return response.data
  },

  /**
   * Obtiene el árbol jerárquico de cuentas
   */
  async getTree(): Promise<ChartOfAccountTree[]> {
    const response = await api.get<ChartOfAccountTree[]>('/accounting/accounts/tree')
    return response.data
  },

  /**
   * Obtiene una cuenta por ID
   */
  async getById(id: string): Promise<ChartOfAccount> {
    const response = await api.get<ChartOfAccount>(`/accounting/accounts/${id}`)
    return response.data
  },

  /**
   * Crea una nueva cuenta
   */
  async create(data: CreateAccountDto): Promise<ChartOfAccount> {
    const response = await api.post<ChartOfAccount>('/accounting/accounts', data)
    return response.data
  },

  /**
   * Actualiza una cuenta
   */
  async update(id: string, data: UpdateAccountDto): Promise<ChartOfAccount> {
    const response = await api.put<ChartOfAccount>(`/accounting/accounts/${id}`, data)
    return response.data
  },

  /**
   * Elimina una cuenta
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/accounting/accounts/${id}`)
  },

  /**
   * Inicializa el plan básico de cuentas
   */
  async initialize(): Promise<{ message: string; accounts_created?: number; mappings_created?: number }> {
    const response = await api.post<{ message: string; accounts_created?: number; mappings_created?: number }>(
      '/accounting/accounts/initialize'
    )
    return response.data
  },
}

/**
 * Servicio para Asientos Contables
 */
export const accountingEntriesService = {
  /**
   * Obtiene los asientos contables
   */
  async getAll(params?: {
    entry_type?: EntryType
    status?: EntryStatus
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }): Promise<AccountingEntry[]> {
    const response = await api.get<AccountingEntry[]>('/accounting/entries', { params })
    return response.data
  },

  /**
   * Obtiene un asiento por ID
   */
  async getById(id: string): Promise<AccountingEntry> {
    const response = await api.get<AccountingEntry>(`/accounting/entries/${id}`)
    return response.data
  },

  /**
   * Crea un asiento contable manual
   */
  async create(data: CreateEntryDto): Promise<AccountingEntry> {
    const response = await api.post<AccountingEntry>('/accounting/entries', data)
    return response.data
  },

  /**
   * Postea un asiento (cambia estado de draft a posted)
   */
  async post(id: string): Promise<AccountingEntry> {
    const response = await api.post<AccountingEntry>(`/accounting/entries/${id}/post`)
    return response.data
  },

  /**
   * Cancela un asiento
   */
  async cancel(id: string, reason: string): Promise<AccountingEntry> {
    const response = await api.post<AccountingEntry>(`/accounting/entries/${id}/cancel`, { reason })
    return response.data
  },
}

/**
 * Servicio para Mapeo de Cuentas
 */
export const accountMappingsService = {
  /**
   * Obtiene todos los mapeos
   */
  async getAll(): Promise<AccountMapping[]> {
    const response = await api.get<AccountMapping[]>('/accounting/mappings')
    return response.data
  },

  /**
   * Obtiene un mapeo por ID
   */
  async getById(id: string): Promise<AccountMapping> {
    const response = await api.get<AccountMapping>(`/accounting/mappings/${id}`)
    return response.data
  },

  /**
   * Crea un nuevo mapeo
   */
  async create(data: CreateMappingDto): Promise<AccountMapping> {
    const response = await api.post<AccountMapping>('/accounting/mappings', data)
    return response.data
  },

  /**
   * Actualiza un mapeo
   */
  async update(id: string, data: UpdateMappingDto): Promise<AccountMapping> {
    const response = await api.put<AccountMapping>(`/accounting/mappings/${id}`, data)
    return response.data
  },

  /**
   * Elimina un mapeo
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/accounting/mappings/${id}`)
  },
}

/**
 * Servicio para Exportaciones
 */
export const accountingExportsService = {
  /**
   * Crea una nueva exportación
   */
  async create(data: CreateExportDto): Promise<AccountingExport> {
    // El backend espera export_type, pero mantenemos compatibilidad
    const response = await api.post<AccountingExport>('/accounting/export', data)
    return response.data
  },

  /**
   * Obtiene todas las exportaciones
   */
  async getAll(): Promise<AccountingExport[]> {
    const response = await api.get<AccountingExport[]>('/accounting/exports')
    return response.data
  },

  /**
   * Obtiene una exportación por ID
   */
  async getById(id: string): Promise<AccountingExport> {
    const response = await api.get<AccountingExport>(`/accounting/exports/${id}`)
    return response.data
  },

  /**
   * Descarga el archivo de exportación
   */
  async download(id: string): Promise<Blob> {
    const response = await api.get(`/accounting/exports/${id}/download`, {
      responseType: 'blob',
    })
    return response.data
  },
}

/**
 * Servicio para Balance de Cuentas
 */
export const accountBalanceService = {
  /**
   * Obtiene el balance de una cuenta
   */
  async getBalance(
    accountId: string,
    params: {
      start_date: string
      end_date: string
    }
  ): Promise<AccountBalance> {
    const response = await api.get<AccountBalance>(`/accounting/balance/${accountId}`, {
      params,
    })
    return response.data
  },
}

/**
 * Servicio para Reportes Contables
 */
export const accountingReportsService = {
  /**
   * Obtiene el Balance General
   */
  async getBalanceSheet(params?: { as_of_date?: string }): Promise<BalanceSheetReport> {
    const response = await api.get<BalanceSheetReport>('/accounting/reports/balance-sheet', {
      params,
    })
    return response.data
  },

  /**
   * Obtiene el Estado de Resultados
   */
  async getIncomeStatement(params: {
    start_date: string
    end_date: string
  }): Promise<IncomeStatementReport> {
    const response = await api.get<IncomeStatementReport>('/accounting/reports/income-statement', {
      params,
    })
    return response.data
  },

  /**
   * Obtiene el Trial Balance (Balance de Comprobación)
   */
  async getTrialBalance(params?: {
    as_of_date?: string
    include_zero_balance?: boolean
  }): Promise<TrialBalanceReport> {
    const response = await api.get<TrialBalanceReport>('/accounting/reports/trial-balance', {
      params,
    })
    return response.data
  },

  /**
   * Obtiene el Libro Mayor (General Ledger)
   */
  async getGeneralLedger(params: {
    start_date: string
    end_date: string
    account_ids?: string[]
  }): Promise<GeneralLedgerReport> {
    const response = await api.get<GeneralLedgerReport>('/accounting/reports/general-ledger', {
      params,
    })
    return response.data
  },

  /**
   * Obtiene el Estado de Flujo de Efectivo
   */
  async getCashFlow(params: {
    start_date: string
    end_date: string
    method?: 'direct' | 'indirect'
  }): Promise<CashFlowReport> {
    const response = await api.get<CashFlowReport>('/accounting/reports/cash-flow', {
      params,
    })
    return response.data
  },
}

/**
 * Servicio para Validación y Reconciliación Contable
 */
export const accountingValidationService = {
  /**
   * Valida la integridad contable del sistema
   */
  async validateAccountingIntegrity(params?: {
    start_date?: string
    end_date?: string
  }): Promise<AccountingValidationResult> {
    const response = await api.get<AccountingValidationResult>('/accounting/validate', {
      params,
    })
    return response.data
  },

  /**
   * Reconcilia cuentas contables
   */
  async reconcileAccounts(params?: {
    account_ids?: string[]
    as_of_date?: string
  }): Promise<AccountingReconciliationResult> {
    const response = await api.post<AccountingReconciliationResult>('/accounting/reconcile', params || {})
    return response.data
  },

  /**
   * Recalcula y corrige totales de asientos desbalanceados
   */
  async recalculateEntryTotals(params?: {
    entry_ids?: string[]
  }): Promise<{
    corrected: number
    errors: Array<{
      entry_id: string
      entry_number: string
      error: string
    }>
  }> {
    const response = await api.post<{
      corrected: number
      errors: Array<{
        entry_id: string
        entry_number: string
        error: string
      }>
    }>('/accounting/recalculate-totals', params || {})
    return response.data
  },
}
