import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';
import { MLInsight } from '../../database/entities/ml-insight.entity';
import { NotificationAnalytics } from '../../database/entities/notification-analytics.entity';
import { User } from '../../database/entities/user.entity';
import { Store } from '../../database/entities/store.entity';
import { StoreMember } from '../../database/entities/store-member.entity';
import { Profile } from '../../database/entities/profile.entity';
import { MLInsightsService } from './ml-insights.service';
import { TemplateService } from './template.service';
import { EmailService } from './email.service';
import { NotificationsService } from '../notifications.service';
import { randomUUID } from 'crypto';
import { ReportsService } from '../../reports/reports.service';
import { DashboardService } from '../../dashboard/dashboard.service';

export interface CreateMLNotificationOptions {
  mlInsight: MLInsight;
  templateKey?: string;
  targetRoles?: string[];
  targetUsers?: string[];
  language?: string;
  forceChannels?: string[];
}

/**
 * Notification Orchestrator
 * Cerebro del sistema de notificaciones ML-driven
 * Coordina la generación de insights, templates, y envío multi-canal
 */
@Injectable()
export class NotificationOrchestratorService {
  private readonly logger = new Logger(NotificationOrchestratorService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(MLInsight)
    private mlInsightRepository: Repository<MLInsight>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(NotificationAnalytics)
    private analyticsRepository: Repository<NotificationAnalytics>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(StoreMember)
    private storeMemberRepository: Repository<StoreMember>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    private mlInsightsService: MLInsightsService,
    private templateService: TemplateService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private reportsService: ReportsService,
    private dashboardService: DashboardService,
  ) {}

  /**
   * Procesa insights de ML y genera notificaciones automáticamente
   */
  async processMLInsights(storeId: string): Promise<number> {
    this.logger.log(`Processing ML insights for store ${storeId}`);

    // Generar todos los insights
    const insights = await this.mlInsightsService.generateAllInsights(storeId);

    let notificationsCreated = 0;

    for (const insight of insights) {
      // Solo procesar insights que no han sido notificados
      if (insight.notification_sent) {
        continue;
      }

      try {
        // Determinar template key basado en el tipo de insight
        const templateKey = this.getTemplateKeyForInsight(insight);

        // Crear notificación desde el insight
        await this.createNotificationFromInsight({
          mlInsight: insight,
          templateKey,
        });

        notificationsCreated++;
      } catch (error) {
        this.logger.error(
          `Failed to create notification for insight ${insight.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Created ${notificationsCreated} notifications from ${insights.length} insights`,
    );
    return notificationsCreated;
  }

  /**
   * Crea una notificación desde un insight de ML
   */
  async createNotificationFromInsight(
    options: CreateMLNotificationOptions,
  ): Promise<Notification> {
    const { mlInsight, templateKey, targetRoles, targetUsers, language } =
      options;

    this.logger.log(
      `Creating notification for insight ${mlInsight.id} (${mlInsight.insight_type})`,
    );

    // Obtener usuarios objetivo
    const recipients = await this.getTargetUsers(
      mlInsight.store_id,
      targetRoles,
      targetUsers,
    );

    if (recipients.length === 0) {
      this.logger.warn(`No recipients found for insight ${mlInsight.id}`);
      throw new Error('No recipients found');
    }

    // Preparar variables para el template
    const templateVariables = this.prepareTemplateVariables(mlInsight);

    // Determinar template key
    const finalTemplateKey =
      templateKey || this.getTemplateKeyForInsight(mlInsight);

    // Renderizar template
    const rendered = await this.templateService.renderTemplate(
      finalTemplateKey,
      {
        language: language || 'es',
        variables: templateVariables,
        channel: 'in_app',
      },
      mlInsight.store_id,
    );

    // Determinar canales de entrega
    const channels =
      options.forceChannels || this.getChannelsForInsight(mlInsight);

    // Determinar prioridad
    const priority = this.getPriorityFromSeverity(mlInsight.severity);

    // Crear notificaciones para cada usuario
    const notifications: Notification[] = [];

    for (const user of recipients) {
      // Crear notificación base
      const notificationData: Partial<Notification> = {
        store_id: mlInsight.store_id,
        user_id: user.id,
        notification_type: this.mapInsightTypeToNotificationType(
          mlInsight.insight_type,
        ) as any,
        category: mlInsight.insight_category,
        title: rendered.title,
        message: rendered.body,
        priority: priority as any,
        severity: mlInsight.severity,
        entity_type: (mlInsight.entity_type as any) || null,
        entity_id: mlInsight.entity_id || null,
        action_url: this.generateActionUrl(mlInsight),
        action_label: mlInsight.is_actionable ? 'Ver Detalles' : null,
        delivery_channels: channels,
        is_read: false,
        is_delivered: false,
        metadata: {
          ml_insight_id: mlInsight.id,
          template_variables: templateVariables,
          is_ml_generated: true,
          confidence_score: mlInsight.confidence_score,
          model_type: mlInsight.model_type,
          suggested_actions: mlInsight.suggested_actions,
        },
      };

      const notification = this.notificationRepository.create(notificationData);
      notification.id = randomUUID();

      const saved = await this.notificationRepository.save(notification);
      notifications.push(saved);

      // Entregar por los canales configurados
      await this.deliverNotification(saved, user, rendered.html);
    }

    // Marcar insight como notificado
    mlInsight.notification_sent = true;
    mlInsight.notification_id = notifications[0]?.id || null;
    await this.mlInsightRepository.save(mlInsight);

    this.logger.log(
      `Created ${notifications.length} notifications for insight ${mlInsight.id}`,
    );

    return notifications[0];
  }

  /**
   * Entrega una notificación por los canales configurados
   */
  private async deliverNotification(
    notification: Notification,
    user: User,
    emailHtml?: string,
  ): Promise<void> {
    const channels = notification.delivery_channels || ['in_app'];

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            if (emailHtml && user.email) {
              await this.deliverEmail(notification, user, emailHtml);
            }
            break;

          case 'push':
            await this.deliverPush(notification, user);
            break;

          case 'websocket':
          case 'in_app':
            await this.deliverWebSocket(notification, user);
            break;
        }

        // Crear analítica de entrega
        await this.createDeliveryAnalytics(notification, user, channel);
      } catch (error) {
        this.logger.error(
          `Failed to deliver notification ${notification.id} via ${channel}:`,
          error,
        );
      }
    }

    // Marcar como entregada
    notification.is_delivered = true;
    notification.delivered_at = new Date();
    await this.notificationRepository.save(notification);
  }

  /**
   * Entrega por email
   */
  private async deliverEmail(
    notification: Notification,
    user: User,
    htmlBody: string,
  ): Promise<void> {
    if (!user.email) {
      this.logger.warn(
        `⚠️ Cannot send email for notification ${notification.id}: user ${user.id} has no email`,
      );
      return;
    }

    if (!this.emailService.isAvailable()) {
      this.logger.warn(
        `⚠️ Cannot send email for notification ${notification.id}: email service not available`,
      );
      return;
    }

    try {
      this.logger.log(
        `📧 Sending email notification ${notification.id} to ${user.email}`,
      );

      await this.emailService.sendEmail({
        storeId: notification.store_id,
        notificationId: notification.id,
        to: user.email,
        toName: user.name || undefined,
        subject: notification.title,
        htmlBody,
        textBody: notification.message,
        templateId: (notification.metadata as any)?.template_id || undefined,
        templateVariables:
          (notification.metadata as any)?.template_variables || undefined,
        priority: this.getPriorityScore(notification.priority),
      });

      this.logger.log(
        `✅ Email notification ${notification.id} sent successfully to ${user.email}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send email notification ${notification.id} to ${user.email}:`,
        error instanceof Error ? error.message : String(error),
      );
      // No re-lanzar el error para que otros canales puedan funcionar
    }
  }

  /**
   * Entrega por push notification
   */
  private async deliverPush(
    notification: Notification,
    user: User,
  ): Promise<void> {
    try {
      // TODO: Implement push notification delivery
      // The NotificationsService needs to expose a public method for this
      this.logger.log(
        `Push notification ${notification.id} delivery skipped (not implemented yet)`,
      );
    } catch (error) {
      this.logger.error(`Failed to send push notification:`, error);
    }
  }

  /**
   * Entrega por WebSocket
   */
  private async deliverWebSocket(
    notification: Notification,
    user: User,
  ): Promise<void> {
    try {
      // El gateway existente ya maneja esto
      // Solo registramos que se intentó
      this.logger.log(
        `WebSocket notification ${notification.id} will be delivered to user ${user.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send WebSocket notification:`, error);
    }
  }

  /**
   * Crea registro de analíticas de entrega
   */
  private async createDeliveryAnalytics(
    notification: Notification,
    user: User,
    channel: string,
  ): Promise<void> {
    const analytics = this.analyticsRepository.create({
      id: randomUUID(),
      store_id: notification.store_id,
      notification_id: notification.id,
      user_id: user.id,
      delivery_channel: channel as any,
      delivery_status: 'sent',
      delivered_at: new Date(),
    });

    await this.analyticsRepository.save(analytics);
  }

  /**
   * Obtiene usuarios objetivo basado en roles o IDs específicos
   */
  private async getTargetUsers(
    storeId: string,
    targetRoles?: string[],
    targetUsers?: string[],
  ): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.store_id = :storeId', { storeId })
      .andWhere('user.is_active = true');

    if (targetUsers && targetUsers.length > 0) {
      query.andWhere('user.id IN (:...userIds)', { userIds: targetUsers });
    }

    if (targetRoles && targetRoles.length > 0) {
      query.andWhere('user.role IN (:...roles)', { roles: targetRoles });
    }

    // Si no hay filtros específicos, enviar a managers
    if (!targetUsers && !targetRoles) {
      query.andWhere("user.role IN ('owner', 'manager', 'store_manager')");
    }

    return await query.getMany();
  }

  /**
   * Prepara variables del template desde el insight
   */
  private prepareTemplateVariables(insight: MLInsight): Record<string, any> {
    const baseVariables: Record<string, any> = {
      title: insight.title,
      description: insight.description,
      severity: insight.severity,
      confidence: insight.confidence_score,
      insightType: insight.insight_type,
      category: insight.insight_category,
      ...insight.ml_data,
    };

    // Agregar action URL si está disponible
    if (insight.is_actionable && insight.suggested_actions) {
      baseVariables.actionUrl = this.generateActionUrl(insight);
      baseVariables.actions = insight.suggested_actions;
    }

    return baseVariables;
  }

  /**
   * Determina el template key apropiado para un insight
   */
  private getTemplateKeyForInsight(insight: MLInsight): string {
    // Mapeo de tipos de insight a template keys
    const templateMap: Record<string, string> = {
      demand_forecast: 'demand_high',
      risk: 'stock_alert',
      anomaly: 'anomaly_critical',
      recommendation: 'ml_recommendation',
      opportunity: 'ml_recommendation',
      trend: 'demand_high',
    };

    return templateMap[insight.insight_type] || 'demand_high';
  }

  /**
   * Determina canales de entrega basado en severidad
   */
  private getChannelsForInsight(insight: MLInsight): string[] {
    const channels: string[] = ['in_app', 'websocket'];

    if (insight.severity === 'critical') {
      channels.push('email', 'push');
    } else if (insight.severity === 'high') {
      channels.push('push');
    }

    return channels;
  }

  /**
   * Convierte severidad de insight a prioridad de notificación
   */
  private getPriorityFromSeverity(severity: string): string {
    const priorityMap: Record<string, string> = {
      critical: 'urgent',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };

    return priorityMap[severity] || 'medium';
  }

  /**
   * Convierte prioridad a score numérico
   */
  private getPriorityScore(priority: string): number {
    const scoreMap: Record<string, number> = {
      urgent: 100,
      high: 75,
      medium: 50,
      low: 25,
    };

    return scoreMap[priority] || 50;
  }

  /**
   * Mapea tipo de insight a tipo de notificación
   */
  private mapInsightTypeToNotificationType(insightType: string): string {
    const typeMap: Record<string, string> = {
      demand_forecast: 'inventory',
      risk: 'inventory',
      anomaly: 'realtime_analytics',
      recommendation: 'sales',
      opportunity: 'sales',
      trend: 'inventory',
    };

    return typeMap[insightType] || 'general';
  }

  /**
   * Genera URL de acción para el insight
   */
  private generateActionUrl(insight: MLInsight): string | null {
    if (!insight.entity_id) {
      return `/ml/insights/${insight.id}`;
    }

    const urlMap: Record<string, string> = {
      product: `/inventory/products/${insight.entity_id}`,
      sale: `/sales/${insight.entity_id}`,
      category: `/inventory/categories`,
    };

    return urlMap[insight.entity_type || ''] || `/ml/insights/${insight.id}`;
  }

  /**
   * Genera digest diario de insights
   */
  async generateDailyDigest(storeId: string): Promise<void> {
    this.logger.log(`Generating daily digest for store ${storeId}`);

    // Obtener insights activos de las últimas 24 horas
    const insights = await this.mlInsightRepository
      .createQueryBuilder('insight')
      .where('insight.store_id = :storeId', { storeId })
      .andWhere("insight.created_at >= NOW() - INTERVAL '24 hours'")
      .andWhere('insight.is_resolved = false')
      .orderBy('insight.priority', 'DESC')
      .limit(10)
      .getMany();

    if (insights.length === 0) {
      this.logger.log('No insights for daily digest');
      return;
    }

    // Agrupar insights por categoría
    const groupedInsights = this.groupInsightsByCategory(insights);

    // Obtener managers
    const managers = await this.getTargetUsers(storeId);

    for (const manager of managers) {
      try {
        // Renderizar template de digest
        const rendered = await this.templateService.renderTemplate(
          'ml_daily_digest',
          {
            language: 'es',
            variables: {
              userName: manager.name || 'Manager',
              insights: groupedInsights,
              totalInsights: insights.length,
              criticalCount: insights.filter((i) => i.severity === 'critical')
                .length,
              highCount: insights.filter((i) => i.severity === 'high').length,
            },
            channel: 'email',
          },
          storeId,
        );

        // Enviar email digest
        if (manager.email && rendered.html) {
          await this.emailService.sendEmail({
            storeId,
            to: manager.email,
            toName: manager.name || undefined,
            subject: rendered.title,
            htmlBody: rendered.html,
            textBody: rendered.body,
            priority: 50,
          });

          this.logger.log(`Daily digest sent to ${manager.email}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send digest to ${manager.email}:`, error);
      }
    }
  }

  /**
   * Genera reporte semanal para owners
   */
  async generateWeeklyOwnerReport(storeId: string): Promise<void> {
    this.logger.log(`Generating weekly owner report for store ${storeId}`);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      select: ['id', 'name'],
    });

    const owners = await this.storeMemberRepository.find({
      where: { store_id: storeId, role: 'owner' },
      relations: ['profile'],
    });

    if (owners.length === 0) {
      this.logger.warn(`No owners found for store ${storeId}`);
      return;
    }

    const salesSummary = await this.reportsService.getSalesByDay(
      storeId,
      startDate,
      endDate,
    );

    const topProducts = await this.reportsService.getTopProducts(
      storeId,
      5,
      startDate,
      endDate,
    );

    const kpis = await this.dashboardService.getKPIs(
      storeId,
      startDate,
      endDate,
    );

    const debtSummary = await this.reportsService.getDebtSummary(storeId);

    const insights = await this.mlInsightRepository
      .createQueryBuilder('insight')
      .where('insight.store_id = :storeId', { storeId })
      .andWhere('insight.created_at >= :startDate', { startDate })
      .andWhere('insight.created_at <= :endDate', { endDate })
      .getMany();

    const anomalyCount = insights.filter(
      (i) => i.insight_type === 'anomaly',
    ).length;
    const recommendationCount = insights.filter((i) =>
      ['recommendation', 'opportunity'].includes(i.insight_type),
    ).length;
    const criticalCount = insights.filter(
      (i) => i.severity === 'critical',
    ).length;
    const highCount = insights.filter((i) => i.severity === 'high').length;

    const topProductsSummary = topProducts.map((p) => {
      const quantity = p.is_weight_product
        ? p.quantity_sold_kg
        : p.quantity_sold_units;
      return {
        name: p.product_name,
        quantity: Number(quantity || 0),
        revenue_usd: Number(p.revenue_usd || 0),
        revenue_bs: Number(p.revenue_bs || 0),
        is_weight_product: p.is_weight_product,
        weight_unit: p.weight_unit,
      };
    });

    for (const owner of owners) {
      const profile = owner.profile;
      if (!profile?.email) continue;

      const rendered = await this.templateService.renderTemplate(
        'ml_weekly_report',
        {
          language: 'es',
          channel: 'email',
          variables: {
            userName: profile.full_name || 'Owner',
            storeName: store?.name || 'Tu tienda',
            startDate,
            endDate,
            totalSalesCount: salesSummary.total_sales,
            totalSalesBs: salesSummary.total_amount_bs,
            totalSalesUsd: salesSummary.total_amount_usd,
            totalProfitBs: salesSummary.total_profit_bs,
            totalProfitUsd: salesSummary.total_profit_usd,
            profitMargin: salesSummary.profit_margin,
            lowStockCount: kpis.inventory.low_stock_count,
            expiringSoonCount: kpis.inventory.expiring_soon_count,
            pendingDebtBs: debtSummary.total_pending_bs,
            pendingDebtUsd: debtSummary.total_pending_usd,
            anomalyCount,
            recommendationCount,
            criticalCount,
            highCount,
            topProducts: topProductsSummary,
            dashboardUrl: '/dashboard',
          },
        },
        storeId,
      );

      await this.emailService.sendEmail({
        storeId,
        to: profile.email,
        toName: profile.full_name || undefined,
        subject: rendered.title,
        htmlBody: rendered.html || rendered.body,
        textBody: rendered.body,
        priority: 60,
      });

      this.logger.log(`Weekly report sent to ${profile.email}`);
    }
  }

  /**
   * Agrupa insights por categoría
   */
  private groupInsightsByCategory(insights: MLInsight[]): any {
    const grouped: Record<string, MLInsight[]> = {};

    for (const insight of insights) {
      const category = insight.insight_category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(insight);
    }

    return grouped;
  }
}
