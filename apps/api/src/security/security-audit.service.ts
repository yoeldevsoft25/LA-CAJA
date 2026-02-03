import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { SecurityAuditLog } from '../database/entities/security-audit-log.entity';

export type AuditEventType =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'login_blocked'
  | 'permission_change'
  | 'admin_action'
  | 'sensitive_data_access'
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'registration_success'
  | 'registration_failure'
  | 'price_modification'
  | 'discount_applied'
  | 'payment_mismatch'
  | 'cash_session_closed'
  | 'sale_void_attempt';

export interface AuditLogData {
  event_type: AuditEventType;
  store_id?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_path?: string;
  request_method?: string;
  status: 'success' | 'failure' | 'blocked';
  details?: Record<string, any>;
}

/**
 * Servicio de auditoría de seguridad
 * Registra eventos críticos para detección de amenazas y cumplimiento
 */
@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(
    @InjectRepository(SecurityAuditLog)
    private auditRepository: Repository<SecurityAuditLog>,
  ) {}

  /**
   * Registra un evento de seguridad
   * No debe fallar la aplicación si el logging falla
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      const auditLog = this.auditRepository.create({
        event_type: data.event_type,
        store_id: data.store_id || null,
        user_id: data.user_id || null,
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || null,
        request_path: data.request_path || null,
        request_method: data.request_method || null,
        status: data.status,
        details: data.details || null,
      });

      await this.auditRepository.save(auditLog);
    } catch (error) {
      // No fallar la aplicación si falla el logging
      this.logger.error('Error guardando audit log', error);
    }
  }

  /**
   * Obtiene el número de intentos de login fallidos desde una IP o store_id
   * Útil para rate limiting y bloqueo progresivo
   * Si identifier empieza con "store:", busca por store_id, sino por ip_address
   */
  async getFailedLoginAttempts(
    identifier: string,
    minutes: number = 15,
  ): Promise<number> {
    try {
      const since = new Date(Date.now() - minutes * 60 * 1000);

      // Si el identificador empieza con "store:", buscar por store_id
      if (identifier.startsWith('store:')) {
        const storeId = identifier.replace('store:', '');
        return await this.auditRepository.count({
          where: {
            event_type: 'login_failure',
            store_id: storeId,
            created_at: MoreThanOrEqual(since),
          },
        });
      }

      // Por defecto, buscar por IP
      return await this.auditRepository.count({
        where: {
          event_type: 'login_failure',
          ip_address: identifier,
          created_at: MoreThanOrEqual(since),
        },
      });
    } catch (error) {
      this.logger.error('Error obteniendo intentos fallidos', error);
      return 0;
    }
  }

  /**
   * Obtiene logs de auditoría con paginación
   */
  async getAuditLogs(
    storeId?: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: SecurityAuditLog[]; total: number }> {
    try {
      const query = this.auditRepository.createQueryBuilder('log');

      if (storeId) {
        query.where('log.store_id = :storeId', { storeId });
      }

      const total = await query.getCount();
      const logs = await query
        .orderBy('log.created_at', 'DESC')
        .limit(limit)
        .offset(offset)
        .getMany();

      return { logs, total };
    } catch (error) {
      this.logger.error('Error obteniendo audit logs', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Obtiene eventos de seguridad por tipo
   */
  async getEventsByType(
    eventType: AuditEventType,
    limit: number = 100,
  ): Promise<SecurityAuditLog[]> {
    try {
      return await this.auditRepository.find({
        where: { event_type: eventType },
        order: { created_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Error obteniendo eventos por tipo', error);
      return [];
    }
  }

  /**
   * Reporte de actividad sospechosa con alertas básicas
   */
  async getSuspiciousActivityReport(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50,
  ): Promise<{
    window: { start_date: Date | null; end_date: Date | null };
    totals_by_type: Record<string, number>;
    alerts: Array<{
      event_type: AuditEventType;
      threshold: number;
      count: number;
      message: string;
    }>;
    recent_events: SecurityAuditLog[];
  }> {
    try {
      const suspiciousTypes: AuditEventType[] = [
        'price_modification',
        'discount_applied',
        'payment_mismatch',
        'sale_void_attempt',
        'unauthorized_access',
      ];

      const query = this.auditRepository
        .createQueryBuilder('log')
        .where('log.store_id = :storeId', { storeId })
        .andWhere('log.event_type IN (:...types)', { types: suspiciousTypes });

      if (startDate) {
        query.andWhere('log.created_at >= :startDate', { startDate });
      }

      if (endDate) {
        query.andWhere('log.created_at <= :endDate', { endDate });
      }

      const counts = await query
        .clone()
        .select('log.event_type', 'event_type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.event_type')
        .getRawMany<{ event_type: AuditEventType; count: string }>();

      const totalsByType: Record<string, number> = {};
      for (const eventType of suspiciousTypes) {
        totalsByType[eventType] = 0;
      }

      for (const row of counts) {
        totalsByType[row.event_type] = Number(row.count || 0);
      }

      const alertRules: Array<{
        event_type: AuditEventType;
        threshold: number;
        message: string;
      }> = [
        {
          event_type: 'payment_mismatch',
          threshold: 1,
          message: 'Se detectaron pagos que no cuadran con el total.',
        },
        {
          event_type: 'price_modification',
          threshold: 3,
          message: 'Se detectaron múltiples modificaciones de precio.',
        },
        {
          event_type: 'sale_void_attempt',
          threshold: 1,
          message: 'Se registraron intentos de anulación de ventas.',
        },
        {
          event_type: 'discount_applied',
          threshold: 10,
          message: 'Se detectó un volumen alto de descuentos en el periodo.',
        },
      ];

      const alerts = alertRules
        .map((rule) => ({
          event_type: rule.event_type,
          threshold: rule.threshold,
          count: totalsByType[rule.event_type] || 0,
          message: rule.message,
        }))
        .filter((alert) => alert.count >= alert.threshold);

      const recentEvents = await query
        .clone()
        .orderBy('log.created_at', 'DESC')
        .limit(limit)
        .getMany();

      return {
        window: {
          start_date: startDate || null,
          end_date: endDate || null,
        },
        totals_by_type: totalsByType,
        alerts,
        recent_events: recentEvents,
      };
    } catch (error) {
      this.logger.error('Error obteniendo reporte sospechoso', error);
      return {
        window: { start_date: startDate || null, end_date: endDate || null },
        totals_by_type: {},
        alerts: [],
        recent_events: [],
      };
    }
  }
}
