import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UptimeRecord, UptimeStatus } from '../entities/uptime-record.entity';
import { UptimeStatsDto } from '../dto/uptime.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UptimeTrackerService {
  private readonly logger = new Logger(UptimeTrackerService.name);
  private readonly targetUptime: number; // 99.9% SLA

  constructor(
    @InjectRepository(UptimeRecord)
    private uptimeRepository: Repository<UptimeRecord>,
    private configService: ConfigService,
  ) {
    // El target puede ser configurado por variable de entorno
    const envTarget = this.configService.get<number>('UPTIME_TARGET');
    this.targetUptime = envTarget || 99.9;
  }

  /**
   * Registra un health check
   */
  async recordHealthCheck(
    serviceName: string,
    status: UptimeStatus,
    responseTime?: number,
    error?: string,
  ): Promise<UptimeRecord> {
    const record = this.uptimeRepository.create({
      timestamp: new Date(),
      service_name: serviceName,
      status,
      response_time_ms: responseTime || null,
      error_message: error || null,
    });

    return this.uptimeRepository.save(record);
  }

  /**
   * Calcula el uptime para un período
   */
  async calculateUptime(
    serviceName?: string,
    periodDays: number = 30,
  ): Promise<UptimeStatsDto> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const query = this.uptimeRepository
      .createQueryBuilder('record')
      .where('record.timestamp >= :periodStart', { periodStart });

    if (serviceName) {
      query.andWhere('record.service_name = :serviceName', { serviceName });
    }

    const records = await query.orderBy('record.timestamp', 'ASC').getMany();

    const totalChecks = records.length;
    const successfulChecks = records.filter(
      (r) => r.status === UptimeStatus.UP,
    ).length;
    const failedChecks = totalChecks - successfulChecks;

    // Calcular tiempo total de uptime y downtime
    // Asumimos que cada check representa un intervalo de tiempo
    // Para simplificar, calculamos basado en porcentaje de checks exitosos
    const uptimePercentage =
      totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;

    // Calcular tiempo en segundos (asumiendo checks cada minuto)
    const checkIntervalSeconds = 60; // 1 minuto entre checks
    const totalSeconds = totalChecks * checkIntervalSeconds;
    const totalUptimeSeconds = successfulChecks * checkIntervalSeconds;
    const totalDowntimeSeconds = failedChecks * checkIntervalSeconds;

    return {
      uptime: parseFloat(uptimePercentage.toFixed(3)),
      targetUptime: this.targetUptime,
      totalUptimeSeconds,
      totalDowntimeSeconds,
      totalChecks,
      successfulChecks,
      failedChecks,
      period: `${periodDays} days`,
      periodStart,
      periodEnd: new Date(),
    };
  }

  /**
   * Obtiene el historial de uptime
   */
  async getUptimeHistory(
    serviceName?: string,
    hours: number = 24,
    limit: number = 1000,
  ) {
    const periodStart = new Date();
    periodStart.setHours(periodStart.getHours() - hours);

    const query = this.uptimeRepository
      .createQueryBuilder('record')
      .where('record.timestamp >= :periodStart', { periodStart })
      .orderBy('record.timestamp', 'DESC')
      .take(limit);

    if (serviceName) {
      query.andWhere('record.service_name = :serviceName', { serviceName });
    }

    return query.getMany();
  }

  /**
   * Verifica si el uptime está por debajo del objetivo
   */
  async isUptimeBelowTarget(serviceName?: string): Promise<boolean> {
    const stats = await this.calculateUptime(serviceName, 30);
    return stats.uptime < this.targetUptime;
  }

  /**
   * Limpia registros antiguos (más de 90 días)
   */
  async cleanOldRecords(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.uptimeRepository
      .createQueryBuilder()
      .delete()
      .from(UptimeRecord)
      .where('timestamp < :ninetyDaysAgo', { ninetyDaysAgo })
      .execute();

    return result.affected || 0;
  }
}
