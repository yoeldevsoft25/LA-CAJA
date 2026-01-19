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
  | 'registration_failure';

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
   * Obtiene el número de intentos de login fallidos desde una IP
   * Útil para rate limiting y bloqueo progresivo
   */
  async getFailedLoginAttempts(
    ipAddress: string,
    minutes: number = 15,
  ): Promise<number> {
    try {
      const since = new Date(Date.now() - minutes * 60 * 1000);
      return await this.auditRepository.count({
        where: {
          event_type: 'login_failure',
          ip_address: ipAddress,
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
}

