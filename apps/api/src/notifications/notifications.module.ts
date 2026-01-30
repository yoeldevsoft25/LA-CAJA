import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { QueuesModule } from '../queues/queues.module';
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
import { Store } from '../database/entities/store.entity';
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
      Store,
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
    QueuesModule,
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
    NotificationsGateway, // ✅ Exportar para que LicenseWatcherService pueda usarlo
    MLInsightsService,
    NotificationOrchestratorService,
    AnalyticsService,
    EmailService,
  ],
})
export class NotificationsModule { }
