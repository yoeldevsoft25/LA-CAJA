import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationAnalytics } from '../../database/entities/notification-analytics.entity';
import { Notification } from '../../database/entities/notification.entity';
import { MLInsight } from '../../database/entities/ml-insight.entity';

export interface EngagementMetrics {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalActions: number;
  openRate: number;
  clickRate: number;
  actionRate: number;
  avgTimeToOpen: number;
  avgTimeToAction: number;
}

export interface ChannelPerformance {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

export interface MLInsightMetrics {
  totalInsights: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  notificationsSent: number;
  actionableInsights: number;
  resolvedInsights: number;
  avgConfidence: number;
}

/**
 * Analytics Service
 * Proporciona métricas y analytics avanzados de notificaciones
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(NotificationAnalytics)
    private analyticsRepository: Repository<NotificationAnalytics>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(MLInsight)
    private mlInsightRepository: Repository<MLInsight>,
  ) {}

  /**
   * Obtiene métricas de engagement general
   */
  async getEngagementMetrics(
    storeId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<EngagementMetrics> {
    const query = this.analyticsRepository
      .createQueryBuilder('analytics')
      .where('analytics.store_id = :storeId', { storeId });

    if (dateRange) {
      query
        .andWhere('analytics.created_at >= :from', { from: dateRange.from })
        .andWhere('analytics.created_at <= :to', { to: dateRange.to });
    } else {
      // Por defecto, últimos 30 días
      query.andWhere("analytics.created_at >= NOW() - INTERVAL '30 days'");
    }

    const analytics = await query.getMany();

    const totalSent = analytics.length;
    const totalOpened = analytics.filter((a) => a.opened_at).length;
    const totalClicked = analytics.filter((a) => a.clicked_at).length;
    const totalActions = analytics.filter((a) => a.action_taken).length;

    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const actionRate = totalSent > 0 ? (totalActions / totalSent) * 100 : 0;

    // Calcular tiempos promedio
    const openTimes = analytics
      .filter((a) => a.time_to_open_seconds)
      .map((a) => a.time_to_open_seconds!);

    const actionTimes = analytics
      .filter((a) => a.time_to_action_seconds)
      .map((a) => a.time_to_action_seconds!);

    const avgTimeToOpen =
      openTimes.length > 0
        ? openTimes.reduce((a, b) => a + b, 0) / openTimes.length
        : 0;

    const avgTimeToAction =
      actionTimes.length > 0
        ? actionTimes.reduce((a, b) => a + b, 0) / actionTimes.length
        : 0;

    return {
      totalSent,
      totalOpened,
      totalClicked,
      totalActions,
      openRate: Number(openRate.toFixed(2)),
      clickRate: Number(clickRate.toFixed(2)),
      actionRate: Number(actionRate.toFixed(2)),
      avgTimeToOpen: Math.round(avgTimeToOpen),
      avgTimeToAction: Math.round(avgTimeToAction),
    };
  }

  /**
   * Obtiene performance por canal
   */
  async getChannelPerformance(
    storeId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<ChannelPerformance[]> {
    const query = this.analyticsRepository
      .createQueryBuilder('analytics')
      .where('analytics.store_id = :storeId', { storeId })
      .andWhere('analytics.delivery_channel IS NOT NULL');

    if (dateRange) {
      query
        .andWhere('analytics.created_at >= :from', { from: dateRange.from })
        .andWhere('analytics.created_at <= :to', { to: dateRange.to });
    } else {
      query.andWhere("analytics.created_at >= NOW() - INTERVAL '30 days'");
    }

    const analytics = await query.getMany();

    // Agrupar por canal
    const byChannel = analytics.reduce(
      (acc, item) => {
        const channel = item.delivery_channel || 'unknown';
        if (!acc[channel]) {
          acc[channel] = [];
        }
        acc[channel].push(item);
        return acc;
      },
      {} as Record<string, typeof analytics>,
    );

    // Calcular métricas por canal
    return Object.entries(byChannel).map(([channel, items]) => {
      const sent = items.length;
      const delivered = items.filter(
        (i) => i.delivery_status === 'delivered',
      ).length;
      const opened = items.filter((i) => i.opened_at).length;
      const clicked = items.filter((i) => i.clicked_at).length;

      return {
        channel,
        sent,
        delivered,
        opened,
        clicked,
        deliveryRate:
          sent > 0 ? Number(((delivered / sent) * 100).toFixed(2)) : 0,
        openRate: sent > 0 ? Number(((opened / sent) * 100).toFixed(2)) : 0,
        clickRate: sent > 0 ? Number(((clicked / sent) * 100).toFixed(2)) : 0,
      };
    });
  }

  /**
   * Obtiene métricas de ML insights
   */
  async getMLInsightMetrics(
    storeId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<MLInsightMetrics> {
    const query = this.mlInsightRepository
      .createQueryBuilder('insight')
      .where('insight.store_id = :storeId', { storeId });

    if (dateRange) {
      query
        .andWhere('insight.created_at >= :from', { from: dateRange.from })
        .andWhere('insight.created_at <= :to', { to: dateRange.to });
    } else {
      query.andWhere("insight.created_at >= NOW() - INTERVAL '30 days'");
    }

    const insights = await query.getMany();

    const totalInsights = insights.length;

    // Agrupar por tipo
    const byType = insights.reduce(
      (acc, insight) => {
        acc[insight.insight_type] = (acc[insight.insight_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Agrupar por severidad
    const bySeverity = insights.reduce(
      (acc, insight) => {
        acc[insight.severity] = (acc[insight.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const notificationsSent = insights.filter(
      (i) => i.notification_sent,
    ).length;
    const actionableInsights = insights.filter((i) => i.is_actionable).length;
    const resolvedInsights = insights.filter((i) => i.is_resolved).length;

    // Calcular confianza promedio
    const confidenceScores = insights
      .filter((i) => i.confidence_score)
      .map((i) => i.confidence_score!);

    const avgConfidence =
      confidenceScores.length > 0
        ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
        : 0;

    return {
      totalInsights,
      byType,
      bySeverity,
      notificationsSent,
      actionableInsights,
      resolvedInsights,
      avgConfidence: Number(avgConfidence.toFixed(2)),
    };
  }

  /**
   * Obtiene top notificaciones por engagement
   */
  async getTopPerformingNotifications(
    storeId: string,
    limit: number = 10,
  ): Promise<
    Array<{
      notificationId: string;
      title: string;
      category: string;
      sent: number;
      opened: number;
      clicked: number;
      engagementScore: number;
    }>
  > {
    const notifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.store_id = :storeId', { storeId })
      .andWhere("notification.created_at >= NOW() - INTERVAL '30 days'")
      .orderBy('notification.created_at', 'DESC')
      .limit(100)
      .getMany();

    const notificationStats = await Promise.all(
      notifications.map(async (notification) => {
        const analytics = await this.analyticsRepository
          .createQueryBuilder('analytics')
          .where('analytics.notification_id = :notificationId', {
            notificationId: notification.id,
          })
          .getMany();

        const sent = analytics.length;
        const opened = analytics.filter((a) => a.opened_at).length;
        const clicked = analytics.filter((a) => a.clicked_at).length;

        // Calcular engagement score (weighted)
        const engagementScore =
          opened * 1 + // 1 punto por open
          clicked * 2; // 2 puntos por click

        return {
          notificationId: notification.id,
          title: notification.title,
          category: notification.category || 'general',
          sent,
          opened,
          clicked,
          engagementScore,
        };
      }),
    );

    return notificationStats
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);
  }

  /**
   * Registra interacción de usuario con notificación
   */
  async recordInteraction(params: {
    notificationId: string;
    userId: string;
    interactionType: 'opened' | 'clicked' | 'dismissed' | 'action';
    actionTaken?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { notificationId, userId, interactionType, actionTaken, metadata } =
      params;

    const analytics = await this.analyticsRepository.findOne({
      where: {
        notification_id: notificationId,
        user_id: userId,
      },
    });

    if (!analytics) {
      this.logger.warn(
        `Analytics not found for notification ${notificationId} and user ${userId}`,
      );
      return;
    }

    const now = new Date();

    switch (interactionType) {
      case 'opened':
        if (!analytics.opened_at) {
          analytics.opened_at = now;
          if (analytics.delivered_at) {
            analytics.time_to_open_seconds = Math.floor(
              (now.getTime() - analytics.delivered_at.getTime()) / 1000,
            );
          }
        }
        break;

      case 'clicked':
        if (!analytics.clicked_at) {
          analytics.clicked_at = now;
          if (analytics.delivered_at) {
            analytics.time_to_action_seconds = Math.floor(
              (now.getTime() - analytics.delivered_at.getTime()) / 1000,
            );
          }
        }
        break;

      case 'dismissed':
        analytics.dismissed_at = now;
        break;

      case 'action':
        analytics.action_taken = actionTaken || 'unknown';
        if (!analytics.clicked_at) {
          analytics.clicked_at = now;
        }
        if (analytics.delivered_at) {
          analytics.time_to_action_seconds = Math.floor(
            (now.getTime() - analytics.delivered_at.getTime()) / 1000,
          );
        }
        break;
    }

    if (metadata) {
      analytics.metadata = { ...analytics.metadata, ...metadata };
    }

    await this.analyticsRepository.save(analytics);

    this.logger.log(
      `Recorded ${interactionType} for notification ${notificationId}`,
    );
  }

  /**
   * Obtiene tendencias de engagement por período
   */
  async getEngagementTrends(
    storeId: string,
    days: number = 30,
  ): Promise<
    Array<{
      date: string;
      sent: number;
      opened: number;
      clicked: number;
      openRate: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await this.analyticsRepository
      .createQueryBuilder('analytics')
      .where('analytics.store_id = :storeId', { storeId })
      .andWhere('analytics.created_at >= :startDate', { startDate })
      .orderBy('analytics.created_at', 'ASC')
      .getMany();

    // Agrupar por día
    const byDay = analytics.reduce(
      (acc, item) => {
        const date = item.created_at.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(item);
        return acc;
      },
      {} as Record<string, typeof analytics>,
    );

    return Object.entries(byDay)
      .map(([date, items]) => {
        const sent = items.length;
        const opened = items.filter((i) => i.opened_at).length;
        const clicked = items.filter((i) => i.clicked_at).length;

        return {
          date,
          sent,
          opened,
          clicked,
          openRate: sent > 0 ? Number(((opened / sent) * 100).toFixed(2)) : 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
