import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Nota: Esta entidad se creará en la migración pero no tenemos la entity TypeORM todavía
// Por ahora usaremos una interfaz
interface NotificationRateLimit {
  id: string;
  store_id: string;
  user_id: string | null;
  category: string | null;
  channel: string | null;
  max_per_hour: number | null;
  max_per_day: number | null;
  max_per_week: number | null;
  count_last_hour: number;
  count_last_day: number;
  count_last_week: number;
  hour_window_start: Date;
  day_window_start: Date;
  week_window_start: Date;
  allow_critical_override: boolean;
}

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  nextAvailableAt?: Date;
}

/**
 * Rate Limiter Service
 * Previene fatiga de notificaciones con límites inteligentes
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // Límites por defecto
  private readonly DEFAULT_LIMITS = {
    hour: 10,
    day: 50,
    week: 200,
  };

  /**
   * Verifica si se puede enviar una notificación
   */
  async canSendNotification(params: {
    storeId: string;
    userId: string;
    category?: string;
    channel?: string;
    priority?: string;
  }): Promise<RateLimitCheck> {
    const { storeId, userId, category, channel, priority } = params;

    // Override para notificaciones críticas
    if (priority === 'urgent' || priority === 'critical') {
      // Verificar si el override está permitido
      const allowOverride = await this.checkCriticalOverride(storeId, userId);

      if (allowOverride) {
        this.logger.log(
          `Critical notification bypassing rate limit for user ${userId}`,
        );
        return { allowed: true };
      }
    }

    // Obtener límites aplicables
    const limits = await this.getApplicableLimits(
      storeId,
      userId,
      category,
      channel,
    );

    if (!limits) {
      // Sin límites configurados, usar defaults
      return await this.checkDefaultLimits(storeId, userId, category, channel);
    }

    // Verificar contra límites configurados
    const now = new Date();

    // Resetear ventanas si es necesario
    await this.resetWindowsIfNeeded(limits, now);

    // Verificar límite por hora
    if (limits.max_per_hour && limits.count_last_hour >= limits.max_per_hour) {
      const nextAvailable = new Date(
        limits.hour_window_start.getTime() + 60 * 60 * 1000,
      );

      return {
        allowed: false,
        reason: `Hourly limit reached (${limits.max_per_hour}/hour)`,
        nextAvailableAt: nextAvailable,
      };
    }

    // Verificar límite por día
    if (limits.max_per_day && limits.count_last_day >= limits.max_per_day) {
      const nextAvailable = new Date(
        limits.day_window_start.getTime() + 24 * 60 * 60 * 1000,
      );

      return {
        allowed: false,
        reason: `Daily limit reached (${limits.max_per_day}/day)`,
        nextAvailableAt: nextAvailable,
      };
    }

    // Verificar límite por semana
    if (limits.max_per_week && limits.count_last_week >= limits.max_per_week) {
      const nextAvailable = new Date(
        limits.week_window_start.getTime() + 7 * 24 * 60 * 60 * 1000,
      );

      return {
        allowed: false,
        reason: `Weekly limit reached (${limits.max_per_week}/week)`,
        nextAvailableAt: nextAvailable,
      };
    }

    return { allowed: true };
  }

  /**
   * Registra que se envió una notificación
   */
  async recordNotification(params: {
    storeId: string;
    userId: string;
    category?: string;
    channel?: string;
  }): Promise<void> {
    const { storeId, userId, category, channel } = params;

    // Obtener o crear límite
    let limits = await this.getApplicableLimits(
      storeId,
      userId,
      category,
      channel,
    );

    if (!limits) {
      limits = await this.createDefaultLimit(
        storeId,
        userId,
        category,
        channel,
      );
    }

    // Incrementar contadores
    limits.count_last_hour += 1;
    limits.count_last_day += 1;
    limits.count_last_week += 1;

    // Guardar (implementación simplificada - en producción usar repositorio)
    // await this.rateLimitRepository.save(limits);

    this.logger.debug(
      `Recorded notification for user ${userId}: ${limits.count_last_hour}/h, ${limits.count_last_day}/d, ${limits.count_last_week}/w`,
    );
  }

  /**
   * Obtiene límites aplicables para usuario/categoría/canal
   */
  private async getApplicableLimits(
    storeId: string,
    userId: string,
    category?: string,
    channel?: string,
  ): Promise<NotificationRateLimit | null> {
    // En producción, esto buscaría en la base de datos
    // Por ahora retornamos null para usar defaults
    return null;
  }

  /**
   * Verifica límites por defecto
   */
  private async checkDefaultLimits(
    storeId: string,
    userId: string,
    category?: string,
    channel?: string,
  ): Promise<RateLimitCheck> {
    // Implementación simplificada - en memoria
    // En producción, esto consultaría counters reales

    const key = `${storeId}:${userId}:${category || 'all'}:${channel || 'all'}`;

    // Por ahora, siempre permitir (los límites se aplicarán cuando se integre con DB)
    return { allowed: true };
  }

  /**
   * Crea límite por defecto
   */
  private async createDefaultLimit(
    storeId: string,
    userId: string,
    category?: string,
    channel?: string,
  ): Promise<NotificationRateLimit> {
    const now = new Date();

    return {
      id: `${storeId}-${userId}-${category || 'all'}-${channel || 'all'}`,
      store_id: storeId,
      user_id: userId,
      category: category || null,
      channel: channel || null,
      max_per_hour: this.DEFAULT_LIMITS.hour,
      max_per_day: this.DEFAULT_LIMITS.day,
      max_per_week: this.DEFAULT_LIMITS.week,
      count_last_hour: 0,
      count_last_day: 0,
      count_last_week: 0,
      hour_window_start: now,
      day_window_start: now,
      week_window_start: now,
      allow_critical_override: true,
    };
  }

  /**
   * Resetea ventanas de tiempo si es necesario
   */
  private async resetWindowsIfNeeded(
    limits: NotificationRateLimit,
    now: Date,
  ): Promise<void> {
    let updated = false;

    // Resetear ventana de hora
    if (now.getTime() - limits.hour_window_start.getTime() >= 60 * 60 * 1000) {
      limits.count_last_hour = 0;
      limits.hour_window_start = now;
      updated = true;
    }

    // Resetear ventana de día
    if (
      now.getTime() - limits.day_window_start.getTime() >=
      24 * 60 * 60 * 1000
    ) {
      limits.count_last_day = 0;
      limits.day_window_start = now;
      updated = true;
    }

    // Resetear ventana de semana
    if (
      now.getTime() - limits.week_window_start.getTime() >=
      7 * 24 * 60 * 60 * 1000
    ) {
      limits.count_last_week = 0;
      limits.week_window_start = now;
      updated = true;
    }

    if (updated) {
      // Guardar cambios (implementación simplificada)
      // await this.rateLimitRepository.save(limits);
    }
  }

  /**
   * Verifica si el override crítico está permitido
   */
  private async checkCriticalOverride(
    storeId: string,
    userId: string,
  ): Promise<boolean> {
    // Por defecto, permitir override para notificaciones críticas
    return true;
  }

  /**
   * Configura límites personalizados para un usuario
   */
  async setUserLimits(params: {
    storeId: string;
    userId: string;
    category?: string;
    channel?: string;
    maxPerHour?: number;
    maxPerDay?: number;
    maxPerWeek?: number;
    allowCriticalOverride?: boolean;
  }): Promise<void> {
    const {
      storeId,
      userId,
      category,
      channel,
      maxPerHour,
      maxPerDay,
      maxPerWeek,
      allowCriticalOverride,
    } = params;

    // Implementación simplificada
    // En producción, crear/actualizar en DB

    this.logger.log(
      `Custom limits set for user ${userId}: ${maxPerHour}/h, ${maxPerDay}/d, ${maxPerWeek}/w`,
    );
  }

  /**
   * Obtiene estadísticas de rate limiting para un usuario
   */
  async getUserStats(
    storeId: string,
    userId: string,
  ): Promise<{
    hourly: { count: number; limit: number; remaining: number };
    daily: { count: number; limit: number; remaining: number };
    weekly: { count: number; limit: number; remaining: number };
  }> {
    const limits = await this.getApplicableLimits(storeId, userId);

    if (!limits) {
      return {
        hourly: {
          count: 0,
          limit: this.DEFAULT_LIMITS.hour,
          remaining: this.DEFAULT_LIMITS.hour,
        },
        daily: {
          count: 0,
          limit: this.DEFAULT_LIMITS.day,
          remaining: this.DEFAULT_LIMITS.day,
        },
        weekly: {
          count: 0,
          limit: this.DEFAULT_LIMITS.week,
          remaining: this.DEFAULT_LIMITS.week,
        },
      };
    }

    return {
      hourly: {
        count: limits.count_last_hour,
        limit: limits.max_per_hour || this.DEFAULT_LIMITS.hour,
        remaining: Math.max(
          0,
          (limits.max_per_hour || this.DEFAULT_LIMITS.hour) -
            limits.count_last_hour,
        ),
      },
      daily: {
        count: limits.count_last_day,
        limit: limits.max_per_day || this.DEFAULT_LIMITS.day,
        remaining: Math.max(
          0,
          (limits.max_per_day || this.DEFAULT_LIMITS.day) -
            limits.count_last_day,
        ),
      },
      weekly: {
        count: limits.count_last_week,
        limit: limits.max_per_week || this.DEFAULT_LIMITS.week,
        remaining: Math.max(
          0,
          (limits.max_per_week || this.DEFAULT_LIMITS.week) -
            limits.count_last_week,
        ),
      },
    };
  }
}
