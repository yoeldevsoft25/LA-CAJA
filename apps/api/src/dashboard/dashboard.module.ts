import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { Shift } from '../database/entities/shift.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { ExchangeRate } from '../database/entities/exchange-rate.entity';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      Product,
      Debt,
      DebtPayment,
      WarehouseStock,
      PurchaseOrder,
      FiscalInvoice,
      Shift,
      ProductLot,
      ExchangeRate,
    ]),
    ReportsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
