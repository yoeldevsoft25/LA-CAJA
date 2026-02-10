import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountingService } from './accounting.service';
import { AccountingExportService } from './accounting-export.service';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingController } from './accounting.controller';
import { BudgetController } from './budget.controller'; // Import BudgetController
import { AccountingSharedService } from './accounting-shared.service';
import { AccountingReportingService } from './accounting-reporting.service';
import { BudgetService } from './budget.service'; // Import BudgetService
import { ReconciliationService } from './reconciliation.service';
import { BankReconciliationService } from './bank-reconciliation.service'; // Import reconcil service
import { AccountingAuditService } from './accounting-audit.service';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { AccountingAccountMapping } from '../database/entities/accounting-account-mapping.entity';
import { AccountBalance } from '../database/entities/account-balance.entity';
import { AccountingExport } from '../database/entities/accounting-export.entity';
import { AccountingERPSync } from '../database/entities/accounting-erp-sync.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { FiscalConfig } from '../database/entities/fiscal-config.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { Product } from '../database/entities/product.entity';
import { AccountingPeriod } from '../database/entities/accounting-period.entity';
import { AccountingBudget } from '../database/entities/accounting-budget.entity'; // Import AccountingBudget
import { AccountingBudgetLine } from '../database/entities/accounting-budget-line.entity'; // Import AccountingBudgetLine
import { Debt } from '../database/entities/debt.entity';
import { BankStatement } from '../database/entities/bank-statement.entity';
import { BankTransaction } from '../database/entities/bank-transaction.entity';
import { AccountingAuditLog } from '../database/entities/accounting-audit-log.entity';
import { LicensesModule } from '../licenses/licenses.module';

import { BankReconciliationController } from './bank-reconciliation.controller'; // Import

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChartOfAccount,
      JournalEntry,
      JournalEntryLine,
      AccountingAccountMapping,
      AccountBalance,
      AccountingExport,
      AccountingERPSync,
      Sale,
      SaleItem,
      PurchaseOrder,
      FiscalInvoice,
      InventoryMovement,
      ProductLot,
      Product,
      AccountingPeriod,
      FiscalConfig,
      Debt,
      AccountingBudget,
      AccountingBudgetLine,
      BankStatement,
      BankTransaction,
      AccountingAuditLog,
    ]),
    LicensesModule,
  ],
  controllers: [AccountingController, BudgetController, BankReconciliationController],
  providers: [
    AccountingService,
    AccountingPeriodService,
    AccountingSharedService,
    AccountingReportingService,
    ChartOfAccountsService,
    AccountingExportService,
    ReconciliationService,
    BudgetService,
    BankReconciliationService,
    AccountingAuditService,
  ],
  exports: [
    AccountingService,
    AccountingPeriodService,
    ChartOfAccountsService,
    AccountingExportService,
    ReconciliationService,
    BudgetService,
    BankReconciliationService,
    AccountingAuditService,
  ],
})
export class AccountingModule { }
