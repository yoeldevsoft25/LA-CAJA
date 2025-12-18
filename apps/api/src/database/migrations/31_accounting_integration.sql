-- Migración 31: Módulo Contable Integrado
-- Sistema contable completo integrado con LA-CAJA, preparado para sincronización con VioTech core

-- Tabla para Plan de Cuentas
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  account_code VARCHAR(50) NOT NULL, -- Código de cuenta (ej: 1.01.01.001)
  account_name VARCHAR(200) NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- asset, liability, equity, revenue, expense
  parent_account_id UUID NULL REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 1, -- Nivel en la jerarquía (1-5)
  is_active BOOLEAN NOT NULL DEFAULT true,
  allows_entries BOOLEAN NOT NULL DEFAULT true, -- Si permite asientos directos
  description TEXT NULL,
  metadata JSONB NULL, -- Información adicional (tax_code, cost_center, etc.)
  created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, account_code)
);

CREATE INDEX idx_chart_of_accounts_store ON chart_of_accounts(store_id);
CREATE INDEX idx_chart_of_accounts_code ON chart_of_accounts(account_code);
CREATE INDEX idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX idx_chart_of_accounts_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX idx_chart_of_accounts_active ON chart_of_accounts(is_active) WHERE is_active = true;

-- Tabla para Asientos Contables (Libro Diario)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entry_number VARCHAR(50) NOT NULL, -- Número de asiento único
  entry_date DATE NOT NULL,
  entry_type VARCHAR(50) NOT NULL, -- sale, purchase, invoice, adjustment, transfer, manual
  source_type VARCHAR(50) NULL, -- sale, purchase_order, fiscal_invoice, manual, etc.
  source_id UUID NULL, -- ID del documento origen (NULL si es manual)
  description TEXT NOT NULL,
  reference_number VARCHAR(100) NULL, -- Número de referencia del documento origen
  total_debit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_credit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_debit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_credit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  exchange_rate NUMERIC(18, 6) NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BS',
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, posted, cancelled
  posted_at TIMESTAMPTZ NULL,
  posted_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancelled_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  cancellation_reason TEXT NULL,
  is_auto_generated BOOLEAN NOT NULL DEFAULT false, -- Si fue generado automáticamente
  exported_to_erp BOOLEAN NOT NULL DEFAULT false,
  exported_at TIMESTAMPTZ NULL,
  erp_sync_id VARCHAR(255) NULL, -- ID en sistema ERP externo (VioTech)
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, entry_number)
);

CREATE INDEX idx_journal_entries_store ON journal_entries(store_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_exported ON journal_entries(exported_to_erp);
CREATE INDEX idx_journal_entries_erp_sync ON journal_entries(erp_sync_id);

-- Tabla para líneas de asiento (débito/crédito)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  account_code VARCHAR(50) NOT NULL, -- Redundante para consultas rápidas
  account_name VARCHAR(200) NOT NULL, -- Redundante para consultas rápidas
  description TEXT NULL,
  debit_amount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  credit_amount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  debit_amount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  credit_amount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  cost_center VARCHAR(50) NULL,
  project_code VARCHAR(50) NULL,
  tax_code VARCHAR(50) NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, line_number)
);

CREATE INDEX idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX idx_journal_entry_lines_code ON journal_entry_lines(account_code);

-- Tabla para saldos de cuentas (balance actualizado)
CREATE TABLE IF NOT EXISTS account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  account_code VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL, -- Inicio del período (mes/año)
  period_end DATE NOT NULL, -- Fin del período
  opening_balance_debit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  opening_balance_credit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  opening_balance_debit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  opening_balance_credit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  period_debit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  period_credit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  period_debit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  period_credit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  closing_balance_debit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  closing_balance_credit_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  closing_balance_debit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  closing_balance_credit_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, account_id, period_start, period_end)
);

CREATE INDEX idx_account_balances_store ON account_balances(store_id);
CREATE INDEX idx_account_balances_account ON account_balances(account_id);
CREATE INDEX idx_account_balances_period ON account_balances(period_start, period_end);

-- Tabla para mapeo automático de cuentas por tipo de transacción
CREATE TABLE IF NOT EXISTS accounting_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- sale_revenue, sale_cost, purchase_expense, etc.
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  account_code VARCHAR(50) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  conditions JSONB NULL, -- Condiciones específicas (payment_method, product_category, etc.)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounting_account_mappings_store ON accounting_account_mappings(store_id);
CREATE INDEX idx_accounting_account_mappings_type ON accounting_account_mappings(transaction_type);
CREATE INDEX idx_accounting_account_mappings_active ON accounting_account_mappings(is_active) WHERE is_active = true;

-- Tabla para exportaciones contables
CREATE TABLE IF NOT EXISTS accounting_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL, -- csv, excel, json, viotech_sync
  format_standard VARCHAR(50) NULL, -- IFRS, NIIF, local
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NULL,
  file_size BIGINT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  entries_count INTEGER NOT NULL DEFAULT 0,
  total_amount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_amount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT NULL,
  exported_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  exported_at TIMESTAMPTZ NULL,
  erp_sync_id VARCHAR(255) NULL, -- ID de sincronización con VioTech/ERP
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounting_exports_store ON accounting_exports(store_id);
CREATE INDEX idx_accounting_exports_type ON accounting_exports(export_type);
CREATE INDEX idx_accounting_exports_date ON accounting_exports(start_date, end_date);
CREATE INDEX idx_accounting_exports_status ON accounting_exports(status);
CREATE INDEX idx_accounting_exports_erp_sync ON accounting_exports(erp_sync_id);

-- Tabla para sincronización con sistemas ERP externos (VioTech core)
CREATE TABLE IF NOT EXISTS accounting_erp_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  erp_system VARCHAR(50) NOT NULL DEFAULT 'viotech', -- viotech, sap, oracle, other
  sync_type VARCHAR(50) NOT NULL, -- entry, export, account, balance
  source_id UUID NOT NULL, -- ID del registro local
  erp_id VARCHAR(255) NOT NULL, -- ID en el sistema ERP
  sync_direction VARCHAR(20) NOT NULL DEFAULT 'push', -- push, pull, bidirectional
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, synced, failed, conflict
  last_sync_at TIMESTAMPTZ NULL,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  metadata JSONB NULL, -- Datos adicionales de sincronización
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, erp_system, sync_type, source_id)
);

CREATE INDEX idx_accounting_erp_syncs_store ON accounting_erp_syncs(store_id);
CREATE INDEX idx_accounting_erp_syncs_erp ON accounting_erp_syncs(erp_system);
CREATE INDEX idx_accounting_erp_syncs_type ON accounting_erp_syncs(sync_type);
CREATE INDEX idx_accounting_erp_syncs_status ON accounting_erp_syncs(status);
CREATE INDEX idx_accounting_erp_syncs_source ON accounting_erp_syncs(source_id);

COMMENT ON TABLE chart_of_accounts IS 'Plan de cuentas contable integrado';
COMMENT ON TABLE journal_entries IS 'Asientos contables del libro diario';
COMMENT ON TABLE journal_entry_lines IS 'Líneas de débito/crédito de los asientos';
COMMENT ON TABLE account_balances IS 'Saldos de cuentas por período';
COMMENT ON TABLE accounting_account_mappings IS 'Mapeo automático de cuentas por tipo de transacción';
COMMENT ON TABLE accounting_exports IS 'Exportaciones contables a diferentes formatos';
COMMENT ON TABLE accounting_erp_syncs IS 'Sincronización con sistemas ERP externos (VioTech Solutions core)';
