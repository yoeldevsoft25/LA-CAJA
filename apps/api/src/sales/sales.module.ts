import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
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
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
