import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './services/observability.service';
import { AlertService } from './services/alert.service';
import { UptimeTrackerService } from './services/uptime-tracker.service';
import { SyncMetricsService } from './services/sync-metrics.service';
import { Alert } from './entities/alert.entity';
import { UptimeRecord } from './entities/uptime-record.entity';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsModule } from '../metrics/metrics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ObservabilityGateway } from './gateways/observability.gateway';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, UptimeRecord]),
    TerminusModule,
    MetricsModule,
    NotificationsModule,
    HealthModule,
  ],
  controllers: [ObservabilityController],
  providers: [
    ObservabilityService,
    AlertService,
    UptimeTrackerService,
    SyncMetricsService,
    ObservabilityGateway,
  ],
  exports: [ObservabilityService, AlertService, UptimeTrackerService, SyncMetricsService],
})
export class ObservabilityModule { }
