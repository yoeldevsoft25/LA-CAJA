import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealTimeAnalyticsService } from './realtime-analytics.service';
import { RealTimeAnalyticsController } from './realtime-analytics.controller';
import { RealTimeAnalyticsGateway } from './realtime-analytics.gateway';
import { RealTimeMetric } from '../database/entities/real-time-metric.entity';
import { AlertThreshold } from '../database/entities/alert-threshold.entity';
import { RealTimeAlert } from '../database/entities/real-time-alert.entity';
import { SalesHeatmap } from '../database/entities/sales-heatmap.entity';
import { ComparativeMetric } from '../database/entities/comparative-metric.entity';
import { Sale } from '../database/entities/sale.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';

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
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    NotificationsModule,
  ],
  controllers: [RealTimeAnalyticsController],
  providers: [RealTimeAnalyticsService, RealTimeAnalyticsGateway],
  exports: [RealTimeAnalyticsService, RealTimeAnalyticsGateway],
})
export class RealTimeAnalyticsModule {}
