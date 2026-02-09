import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueuesModule } from '../queues/queues.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { SaleReturn } from '../database/entities/sale-return.entity';
import { SaleReturnItem } from '../database/entities/sale-return-item.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Customer } from '../database/entities/customer.entity';
import { Profile } from '../database/entities/profile.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { Event } from '../database/entities/event.entity';
import { PaymentsModule } from '../payments/payments.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { FastCheckoutModule } from '../fast-checkout/fast-checkout.module';
import { ProductVariantsModule } from '../product-variants/product-variants.module';
import { ProductLotsModule } from '../product-lots/product-lots.module';
import { ProductSerialsModule } from '../product-serials/product-serials.module';
import { InvoiceSeriesModule } from '../invoice-series/invoice-series.module';
import { PriceListsModule } from '../price-lists/price-lists.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { FiscalInvoicesModule } from '../fiscal-invoices/fiscal-invoices.module';
import { AccountingModule } from '../accounting/accounting.module';
import { ConfigModule as SystemConfigModule } from '../config/config.module';
import { StockEscrow } from '../database/entities/stock-escrow.entity';
import { forwardRef } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { ProjectionsModule } from '../projections/projections.module';
import { LicensesModule } from '../licenses/licenses.module';
import { SalesProjectionQueueProcessor } from './queues/sales-projection.queue';
import { SalesPostProcessingQueueProcessor } from './queues/sales-post-processing.queue';
import { SalesReturnDomainService } from './domain/services/sales-return-domain.service';
import { SalesReturnValidationService } from './domain/services/sales-return-validation.service';
import { SalesReturnInventoryService } from './domain/services/sales-return-inventory.service';
import { SalesReturnFinancialService } from './domain/services/sales-return-financial.service';
import { ObservabilityModule } from '../observability/observability.module';
import { SyncModule } from '../sync/sync.module';
import { FiscalModule } from '../fiscal/fiscal.module';

import { CqrsModule } from '@nestjs/cqrs';
import { GetSaleByIdHandler } from './application/queries/get-sale-by-id/get-sale-by-id.handler';
import { CreateSaleHandler } from './application/commands/create-sale/create-sale.handler';
import { CreateSaleValidator } from './application/commands/create-sale/create-sale.validator';
import { GetSalesListHandler } from './application/queries/get-sales-list/get-sales-list.handler';
import { VoidSaleHandler } from './application/commands/void-sale/void-sale.handler';
import { ReturnItemsHandler } from './application/commands/return-items/return-items.handler';
import { ReturnSaleHandler } from './application/commands/return-sale/return-sale.handler';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      SaleReturn,
      SaleReturnItem,
      Product,
      InventoryMovement,
      Customer,
      Profile,
      Debt,
      DebtPayment,
      CashSession,
      Event,
      StockEscrow,
    ]),
    PaymentsModule,
    DiscountsModule,
    FastCheckoutModule,
    ProductVariantsModule,
    ProductLotsModule,
    ProductSerialsModule,
    InvoiceSeriesModule,
    PriceListsModule,
    PromotionsModule,
    WarehousesModule,
    FiscalInvoicesModule,
    forwardRef(() => AccountingModule),
    SystemConfigModule,
    SecurityModule,
    ProjectionsModule,
    QueuesModule,
    LicensesModule,
    ObservabilityModule,
    SyncModule,
    FiscalModule,
  ],
  controllers: [SalesController],
  providers: [
    SalesService,
    SalesProjectionQueueProcessor,
    SalesPostProcessingQueueProcessor,
    SalesReturnDomainService,
    SalesReturnValidationService,
    SalesReturnInventoryService,
    SalesReturnFinancialService,
    GetSaleByIdHandler,
    CreateSaleHandler,
    CreateSaleValidator,
    GetSalesListHandler,
    VoidSaleHandler,
    ReturnItemsHandler,
    ReturnSaleHandler,
  ],
  exports: [SalesService],
})
export class SalesModule { }
