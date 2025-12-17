import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PdfService } from './pdf.service';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { Customer } from '../database/entities/customer.entity';
import { Shift } from '../database/entities/shift.entity';
import { ShiftCut } from '../database/entities/shift-cut.entity';
import { Profile } from '../database/entities/profile.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { ProductSerial } from '../database/entities/product-serial.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../database/entities/purchase-order-item.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { FiscalInvoiceItem } from '../database/entities/fiscal-invoice-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      Product,
      Debt,
      DebtPayment,
      Customer,
      Shift,
      ShiftCut,
      Profile,
      ProductLot,
      ProductSerial,
      Supplier,
      PurchaseOrder,
      PurchaseOrderItem,
      FiscalInvoice,
      FiscalInvoiceItem,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, PdfService],
  exports: [ReportsService, PdfService],
})
export class ReportsModule {}
