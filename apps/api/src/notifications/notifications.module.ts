import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from '../database/entities/notification.entity';
import { NotificationPreference } from '../database/entities/notification-preference.entity';
import { NotificationSubscription } from '../database/entities/notification-subscription.entity';
import { NotificationDelivery } from '../database/entities/notification-delivery.entity';
import { NotificationBadge } from '../database/entities/notification-badge.entity';
import { NotificationTemplate } from '../database/entities/notification-template.entity';
import { MLInsight } from '../database/entities/ml-insight.entity';
import { NotificationAnalytics } from '../database/entities/notification-analytics.entity';
import { EmailQueue } from '../database/entities/email-queue.entity';
import { DemandPrediction } from '../database/entities/demand-prediction.entity';
import { DetectedAnomaly } from '../database/entities/detected-anomaly.entity';
import { ProductRecommendation } from '../database/entities/product-recommendation.entity';
import { Product } from '../database/entities/product.entity';
import { User } from '../database/entities/user.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Nuevos servicios ML-driven
import { MLInsightsService } from './services/ml-insights.service';
import { TemplateService } from './services/template.service';
import { EmailService } from './services/email.service';
import { NotificationOrchestratorService } from './services/notification-orchestrator.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { AnalyticsService } from './services/analytics.service';
import { QueueManagerService } from './services/queue-manager.service';

// Queue processors
import { NotificationsQueueProcessor } from './queues/notifications.queue';

// Nuevo controller
import { MLNotificationsController } from './ml-notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationSubscription,
      NotificationDelivery,
      NotificationBadge,
      // Nuevas entidades
      NotificationTemplate,
      MLInsight,
      NotificationAnalytics,
      EmailQueue,
      // Entidades de ML existentes
      DemandPrediction,
      DetectedAnomaly,
      ProductRecommendation,
      Product,
      User,
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
    // BullMQ para procesamiento asíncrono
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        // Si existe REDIS_URL (ej: de Render), úsala directamente
        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              maxRetriesPerRequest: null, // Requerido para BullMQ
            },
          };
        }

        // Fallback a configuración por componentes (desarrollo local)
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: configService.get<number>('REDIS_PORT') || 6379,
            password: configService.get<string>('REDIS_PASSWORD'),
            maxRetriesPerRequest: null,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    // Schedule module para cron jobs
    ScheduleModule.forRoot(),
  ],
  controllers: [NotificationsController, MLNotificationsController],
  providers: [
    // Servicios existentes
    NotificationsService,
    NotificationsGateway,
    // Nuevos servicios ML-driven
    MLInsightsService,
    TemplateService,
    EmailService,
    NotificationOrchestratorService,
    RateLimiterService,
    AnalyticsService,
    QueueManagerService,
    // Queue processor
    NotificationsQueueProcessor,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    MLInsightsService,
    NotificationOrchestratorService,
    AnalyticsService,
  ],
})
export class NotificationsModule {}
