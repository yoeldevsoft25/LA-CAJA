import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { forwardRef } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
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
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
