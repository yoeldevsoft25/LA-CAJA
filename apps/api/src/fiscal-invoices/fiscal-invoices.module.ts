import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalInvoicesController } from './fiscal-invoices.controller';
import { FiscalInvoicesService } from './fiscal-invoices.service';
import { SeniatIntegrationService } from './seniat-integration.service';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { FiscalInvoiceItem } from '../database/entities/fiscal-invoice-item.entity';
import { FiscalConfig } from '../database/entities/fiscal-config.entity';
import { Sale } from '../database/entities/sale.entity';
import { Customer } from '../database/entities/customer.entity';
import { Product } from '../database/entities/product.entity';
import { InvoiceSeriesModule } from '../invoice-series/invoice-series.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FiscalInvoice,
      FiscalInvoiceItem,
      FiscalConfig,
      Sale,
      Customer,
      Product,
    ]),
    InvoiceSeriesModule,
  ],
  controllers: [FiscalInvoicesController],
  providers: [FiscalInvoicesService, SeniatIntegrationService],
  exports: [FiscalInvoicesService, SeniatIntegrationService],
})
export class FiscalInvoicesModule {}
