import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { MetricsService } from '../../metrics/metrics.service';
import { AlertService } from './alert.service';
import { UptimeTrackerService } from './uptime-tracker.service';
import { HealthStatusDto, ServiceHealthDto } from '../dto/health-status.dto';
import { MetricsDto } from '../dto/metrics.dto';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    private healthCheckService: HealthCheckService,
    private metricsService: MetricsService,
    private alertService: AlertService,
    private uptimeTracker: UptimeTrackerService,
  ) {}

  /**
   * Obtiene el estado general del sistema
   */
  async getStatus(): Promise<HealthStatusDto> {
    try {
      const healthCheck = await this.healthCheckService.check([
        async () => {
          // Health checks básicos
          return { observability: { status: 'up' } };
        },
      ]);

      const uptimeStats = await this.uptimeTracker.calculateUptime(
        undefined,
        30,
      );
      const activeAlerts = await this.alertService.getActiveAlerts();

      // Determinar estado general
      let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
      if (uptimeStats.uptime < 99.0) {
        overallStatus = 'down';
      } else if (
        uptimeStats.uptime < 99.9 ||
        activeAlerts.some((a) => a.severity === 'critical')
      ) {
        overallStatus = 'degraded';
      }

      // Construir lista de servicios (simplificado)
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

  /**
   * Obtiene métricas agregadas
   */
  async getMetrics(): Promise<MetricsDto> {
    // Este método debería obtener métricas de Prometheus
    // Por ahora retornamos estructura básica
    return {
      http: [],
      database: [],
      queues: [],
      business: [],
      system: [],
    };
  }
}
