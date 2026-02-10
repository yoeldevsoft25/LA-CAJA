import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountingService } from './accounting.service';
import { AccountingExportService } from './accounting-export.service';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingController } from './accounting.controller';
import { AccountingSharedService } from './accounting-shared.service';
import { AccountingReportingService } from './accounting-reporting.service';
import { ReconciliationService } from './reconciliation.service';
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
import { LicensesModule } from '../licenses/licenses.module';

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
    ]),
    LicensesModule,
  ],
  controllers: [AccountingController],
  providers: [
    AccountingService,
    AccountingPeriodService,
    AccountingSharedService,
    AccountingReportingService,
    ChartOfAccountsService,
    AccountingExportService,
    ReconciliationService,
  ],
  exports: [
    AccountingService,
    AccountingPeriodService,
    ChartOfAccountsService,
    AccountingExportService,
    ReconciliationService,
  ],
})
export class AccountingModule {}
