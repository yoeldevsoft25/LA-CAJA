import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceSeriesController } from './invoice-series.controller';
import { InvoiceSeriesService } from './invoice-series.service';
import { InvoiceSeries } from '../database/entities/invoice-series.entity';

/**
 * Módulo para gestión de series de facturas
 */
@Module({
  imports: [TypeOrmModule.forFeature([InvoiceSeries])],
  controllers: [InvoiceSeriesController],
  providers: [InvoiceSeriesService],
  exports: [InvoiceSeriesService],
})
export class InvoiceSeriesModule {}
