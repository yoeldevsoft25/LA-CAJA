import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingAccountingTables20260210000000 implements MigrationInterface {
    name = 'AddMissingAccountingTables20260210000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Tabla para Presupuestos (AccountingBudget)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, active, archived
        total_amount_bs NUMERIC(20, 4) NOT NULL DEFAULT 0,
        total_amount_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
        created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_budgets_store ON accounting_budgets(store_id);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_budgets_period ON accounting_budgets(period_start, period_end);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_budgets_status ON accounting_budgets(status);
    `);

        // 2. Tabla para Líneas de Presupuesto (AccountingBudgetLine)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_budget_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_id UUID NOT NULL REFERENCES accounting_budgets(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
        amount_bs NUMERIC(20, 4) NOT NULL DEFAULT 0,
        amount_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
        notes TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_budget_lines_budget ON accounting_budget_lines(budget_id);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_budget_lines_account ON accounting_budget_lines(account_id);
    `);

        // 3. Tabla para Estados de Cuenta Bancarios (BankStatement)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bank_statements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        bank_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        currency VARCHAR(10) NOT NULL, -- BS, USD
        total_debits NUMERIC(20, 2) NOT NULL DEFAULT 0,
        total_credits NUMERIC(20, 2) NOT NULL DEFAULT 0,
        starting_balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
        ending_balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, pending, reconciled
        filename VARCHAR(255) NULL,
        created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_statements_store ON bank_statements(store_id);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_statements_period ON bank_statements(period_start, period_end);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_statements_status ON bank_statements(status);
    `);

        // 4. Tabla para Transacciones Bancarias (BankTransaction)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        reference_number VARCHAR(255) NULL,
        amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
        type VARCHAR(10) NOT NULL, -- debit, credit
        balance_after NUMERIC(20, 2) NULL,
        is_reconciled BOOLEAN NOT NULL DEFAULT false,
        matched_entry_id UUID NULL REFERENCES journal_entries(id) ON DELETE SET NULL,
        reconciliation_notes TEXT NULL,
        metadata JSONB NULL,
        CONSTRAINT fk_bank_transaction_statement FOREIGN KEY (bank_statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE
      );
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_transactions_statement ON bank_transactions(bank_statement_id);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciled ON bank_transactions(is_reconciled);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched ON bank_transactions(matched_entry_id);
    `);

        // 5. Tabla para Logs de Auditoría Contable (AccountingAuditLog)
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(255) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        before_value JSONB NULL,
        after_value JSONB NULL,
        metadata JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_audit_logs_store ON accounting_audit_logs(store_id);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_audit_logs_action ON accounting_audit_logs(action);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_audit_logs_entity ON accounting_audit_logs(entity_type, entity_id);
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_accounting_audit_logs_created ON accounting_audit_logs(created_at DESC);
    `);

        // Comments
        await queryRunner.query(`COMMENT ON TABLE accounting_budgets IS 'Presupuestos contables y financieros'`);
        await queryRunner.query(`COMMENT ON TABLE accounting_budget_lines IS 'Partidas específicas de cada presupuesto'`);
        await queryRunner.query(`COMMENT ON TABLE bank_statements IS 'Estados de cuenta bancarios para conciliación'`);
        await queryRunner.query(`COMMENT ON TABLE bank_transactions IS 'Transacciones individuales de los estados de cuenta'`);
        await queryRunner.query(`COMMENT ON TABLE accounting_audit_logs IS 'Logs de auditoría específicos para cambios contables'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS accounting_audit_logs`);
        await queryRunner.query(`DROP TABLE IF EXISTS bank_transactions`);
        await queryRunner.query(`DROP TABLE IF EXISTS bank_statements`);
        await queryRunner.query(`DROP TABLE IF EXISTS accounting_budget_lines`);
        await queryRunner.query(`DROP TABLE IF EXISTS accounting_budgets`);
    }
}
