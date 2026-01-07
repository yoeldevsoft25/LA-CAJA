import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigValidationService } from './config-validation.service';
import { ConfigController } from './config.controller';
import { InvoiceSeries } from '../database/entities/invoice-series.entity';
import { PaymentMethodConfig } from '../database/entities/payment-method-config.entity';
import { PriceList } from '../database/entities/price-list.entity';
import { Warehouse } from '../database/entities/warehouse.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceSeries,
      PaymentMethodConfig,
      PriceList,
      Warehouse,
    ]),
  ],
  controllers: [ConfigController],
  providers: [ConfigValidationService],
  exports: [ConfigValidationService],
})
export class ConfigModule {}
