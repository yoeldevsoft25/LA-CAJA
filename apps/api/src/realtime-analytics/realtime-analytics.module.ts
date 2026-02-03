import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealTimeAnalyticsService } from './realtime-analytics.service';
import { RealTimeAnalyticsController } from './realtime-analytics.controller';
import { RealTimeAnalyticsGateway } from './realtime-analytics.gateway';
import { AnalyticsDefaultsService } from './analytics-defaults.service';
import { RealTimeMetric } from '../database/entities/real-time-metric.entity';
import { AlertThreshold } from '../database/entities/alert-threshold.entity';
import { RealTimeAlert } from '../database/entities/real-time-alert.entity';
import { SalesHeatmap } from '../database/entities/sales-heatmap.entity';
import { ComparativeMetric } from '../database/entities/comparative-metric.entity';
import { Sale } from '../database/entities/sale.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { Store } from '../database/entities/store.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { Debt } from '../database/entities/debt.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { Shift } from '../database/entities/shift.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Customer } from '../database/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RealTimeMetric,
      AlertThreshold,
      RealTimeAlert,
      SalesHeatmap,
      ComparativeMetric,
      Sale,
      Product,
      InventoryMovement,
      Store,
      Debt,
      ProductLot,
      PurchaseOrder,
      Shift,
      SaleItem,
      Customer,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error(
            'JWT_SECRET debe estar configurado en las variables de entorno. ' +
              'En producción, esto es obligatorio por seguridad.',
          );
        }
        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '24h' },
        };
      },
      inject: [ConfigService],
    }),
    NotificationsModule,
  ],
  controllers: [RealTimeAnalyticsController],
  providers: [
    RealTimeAnalyticsService,
    RealTimeAnalyticsGateway,
    AnalyticsDefaultsService,
  ],
  exports: [
    RealTimeAnalyticsService,
    RealTimeAnalyticsGateway,
    AnalyticsDefaultsService,
  ],
})
export class RealTimeAnalyticsModule {}
