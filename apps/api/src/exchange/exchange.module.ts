import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeController } from './exchange.controller';
import { ExchangeService } from './exchange.service';
import { SalePaymentsService } from './sale-payments.service';
import {
  ExchangeRate,
  StoreRateConfig,
  SalePayment,
  SaleChange,
} from '../database/entities';
import { SecurityModule } from '../security/security.module';
import { RealTimeAnalyticsModule } from '../realtime-analytics/realtime-analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExchangeRate,
      StoreRateConfig,
      SalePayment,
      SaleChange,
    ]),
    SecurityModule,
    RealTimeAnalyticsModule,
  ],
  controllers: [ExchangeController],
  providers: [ExchangeService, SalePaymentsService],
  exports: [ExchangeService, SalePaymentsService],
})
export class ExchangeModule { }
