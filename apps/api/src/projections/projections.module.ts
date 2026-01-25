import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectionsService } from './projections.service';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { CashSession } from '../database/entities/cash-session.entity';
import { Customer } from '../database/entities/customer.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { FiscalInvoicesModule } from '../fiscal-invoices/fiscal-invoices.module';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      InventoryMovement,
      Sale,
      SaleItem,
      CashSession,
      Customer,
      Debt,
      DebtPayment,
    ]),
    WhatsAppModule,
    FiscalInvoicesModule,
    WarehousesModule,
  ],
  providers: [ProjectionsService],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
