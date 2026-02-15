import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { MetricsService } from '../../metrics/metrics.service';
import { AlertService } from './alert.service';
import { UptimeTrackerService } from './uptime-tracker.service';
import { HealthStatusDto, ServiceHealthDto } from '../dto/health-status.dto';
import { MetricsDto } from '../dto/metrics.dto';
import {
  FederationHealthReport,
  SplitBrainMonitorService,
} from '../../sync/split-brain-monitor.service';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly metricsService: MetricsService,
    private readonly alertService: AlertService,
    private readonly uptimeTracker: UptimeTrackerService,
    private readonly splitBrainMonitorService: SplitBrainMonitorService,
    private readonly dataSource: DataSource,
  ) {}

  async getFederationHealthReport(
    storeId: string,
  ): Promise<FederationHealthReport> {
    return this.splitBrainMonitorService.getHealthReport(storeId);
  }

  async getAllFederationHealthReports(): Promise<FederationHealthReport[]> {
    const stores = await this.dataSource.query('SELECT id FROM stores');
    const reports = await Promise.all(
      stores.map(async (store: { id: string }) => {
        try {
          return await this.splitBrainMonitorService.getHealthReport(store.id);
        } catch (error) {
          this.logger.error(
            `Failed to get health report for store ${store.id}`,
            error,
          );
          return null; // Return null on error for a specific store
        }
      }),
    );
    return reports.filter((report) => report !== null) as FederationHealthReport[];
  }

  async getStatus(): Promise<HealthStatusDto> {
    try {
      const healthCheck = await this.healthCheckService.check([
        async () => {
          return { observability: { status: 'up' } };
        },
      ]);

      const uptimeStats = await this.uptimeTracker.calculateUptime(
        undefined,
        30,
      );
      const activeAlerts = await this.alertService.getActiveAlerts();

      let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
      if (uptimeStats.uptime < 99.0) {
        overallStatus = 'down';
      } else if (
        uptimeStats.uptime < 99.9 ||
        activeAlerts.some((a) => a.severity === 'critical')
      ) {
        overallStatus = 'degraded';
      }

      const services: ServiceHealthDto[] = [
        {
          name: 'database',
          status: 'up',
          lastChecked: new Date(),
        },
        {
          name: 'redis',
          status: 'up',
          lastChecked: new Date(),
        },
      ];

      return {
        status: overallStatus,
        uptime: uptimeStats.uptime,
        targetUptime: uptimeStats.targetUptime,
        services,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting observability status', error);
      throw error;
    }
  }

  async getMetrics(): Promise<MetricsDto> {
    return {
      http: [],
      database: [],
      queues: [],
      business: [],
      system: [],
    };
  }
}
