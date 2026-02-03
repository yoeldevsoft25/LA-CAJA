import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Alert, AlertSeverity, AlertStatus } from '../entities/alert.entity';
import { CreateAlertDto } from '../dto/alert.dto';
import { NotificationsGateway } from '../../notifications/notifications.gateway';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Crea una nueva alerta
   */
  async createAlert(dto: CreateAlertDto): Promise<Alert> {
    const alert = this.alertRepository.create({
      service_name: dto.service_name,
      alert_type: dto.alert_type,
      severity: dto.severity,
      message: dto.message,
      metadata: dto.metadata || null,
      status: AlertStatus.ACTIVE,
    });

    const savedAlert = await this.alertRepository.save(alert);

    // Enviar notificación vía WebSocket si es crítica
    if (dto.severity === AlertSeverity.CRITICAL) {
      this.notificationsGateway.server.emit('alert:new', {
        id: savedAlert.id,
        service_name: savedAlert.service_name,
        severity: savedAlert.severity,
        message: savedAlert.message,
        created_at: savedAlert.created_at,
      });
    }

    this.logger.warn(
      `Alert created: ${dto.service_name} - ${dto.alert_type} (${dto.severity})`,
    );

    return savedAlert;
  }

  /**
   * Obtiene alertas activas
   */
  async getActiveAlerts(serviceName?: string): Promise<Alert[]> {
    const query = this.alertRepository
      .createQueryBuilder('alert')
      .where('alert.status = :status', { status: AlertStatus.ACTIVE })
      .orderBy('alert.created_at', 'DESC');

    if (serviceName) {
      query.andWhere('alert.service_name = :serviceName', { serviceName });
    }

    return query.getMany();
  }

  /**
   * Obtiene todas las alertas con filtros
   */
  async getAlerts(
    status?: AlertStatus,
    severity?: AlertSeverity,
    serviceName?: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ alerts: Alert[]; total: number }> {
    const query = this.alertRepository.createQueryBuilder('alert');

    if (status) {
      query.andWhere('alert.status = :status', { status });
    }

    if (severity) {
      query.andWhere('alert.severity = :severity', { severity });
    }

    if (serviceName) {
      query.andWhere('alert.service_name = :serviceName', { serviceName });
    }

    query.orderBy('alert.created_at', 'DESC').skip(offset).take(limit);

    const [alerts, total] = await query.getManyAndCount();

    return { alerts, total };
  }

  /**
   * Resuelve una alerta
   */
  async resolveAlert(alertId: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolved_at = new Date();

    return this.alertRepository.save(alert);
  }

  /**
   * Marca una alerta como reconocida
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledged_at = new Date();
    alert.acknowledged_by = userId;

    return this.alertRepository.save(alert);
  }

  /**
   * Detecta problemas automáticamente y crea alertas
   */
  async detectAndAlert(
    serviceName: string,
    status: 'up' | 'down' | 'degraded',
    responseTime?: number,
    error?: string,
  ): Promise<void> {
    // Si el servicio está caído, crear alerta crítica
    if (status === 'down') {
      await this.createAlert({
        service_name: serviceName,
        alert_type: 'service_down',
        severity: AlertSeverity.CRITICAL,
        message: `Servicio ${serviceName} está caído${error ? `: ${error}` : ''}`,
        metadata: { responseTime, error },
      });
      return;
    }

    // Si el servicio está degradado, crear alerta de advertencia
    if (status === 'degraded') {
      await this.createAlert({
        service_name: serviceName,
        alert_type: 'service_degraded',
        severity: AlertSeverity.WARNING,
        message: `Servicio ${serviceName} está degradado${error ? `: ${error}` : ''}`,
        metadata: { responseTime, error },
      });
      return;
    }

    // Si la latencia es muy alta, crear alerta de advertencia
    if (responseTime && responseTime > 5000) {
      await this.createAlert({
        service_name: serviceName,
        alert_type: 'high_latency',
        severity: AlertSeverity.WARNING,
        message: `Servicio ${serviceName} tiene latencia alta: ${responseTime}ms`,
        metadata: { responseTime },
      });
    }
  }

  /**
   * Limpia alertas resueltas antiguas (más de 30 días)
   */
  async cleanOldAlerts(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.alertRepository.delete({
      status: AlertStatus.RESOLVED,
      resolved_at: LessThan(thirtyDaysAgo),
    });

    return result.affected || 0;
  }
}
