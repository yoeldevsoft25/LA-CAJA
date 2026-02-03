import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MLInsightsService } from './services/ml-insights.service';
import { NotificationOrchestratorService } from './services/notification-orchestrator.service';
import { AnalyticsService } from './services/analytics.service';
import { QueueManagerService } from './services/queue-manager.service';
import { TemplateService } from './services/template.service';
import { EmailService } from './services/email.service';
import { RateLimiterService } from './services/rate-limiter.service';

/**
 * ML Notifications Controller
 * Endpoints para gestionar notificaciones inteligentes basadas en ML
 */
@Controller('ml-notifications')
@UseGuards(JwtAuthGuard)
export class MLNotificationsController {
  constructor(
    private mlInsightsService: MLInsightsService,
    private orchestratorService: NotificationOrchestratorService,
    private analyticsService: AnalyticsService,
    private queueManagerService: QueueManagerService,
    private templateService: TemplateService,
    private emailService: EmailService,
    private rateLimiterService: RateLimiterService,
  ) {}

  /**
   * Genera insights de ML para una tienda
   */
  @Post('insights/generate')
  async generateInsights(@Request() req: any) {
    const storeId = req.user.storeId;
    const insights = await this.mlInsightsService.generateAllInsights(storeId);
    return {
      success: true,
      total: insights.length,
      insights,
    };
  }

  /**
   * Obtiene insights activos
   */
  @Get('insights')
  async getInsights(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
  ) {
    const storeId = req.user.storeId;

    const insights = await this.mlInsightsService.getActiveInsights(storeId, {
      insightType: type as any,
      severity: severity as any,
      limit: limit ? parseInt(limit) : undefined,
    });

    return {
      success: true,
      total: insights.length,
      insights,
    };
  }

  /**
   * Resuelve un insight
   */
  @Patch('insights/:id/resolve')
  async resolveInsight(
    @Param('id') insightId: string,
    @Request() req: any,
    @Body() body: { note?: string },
  ) {
    const userId = req.user.sub;
    const insight = await this.mlInsightsService.resolveInsight(
      insightId,
      userId,
      body.note,
    );

    return {
      success: true,
      insight,
    };
  }

  /**
   * Procesa insights y genera notificaciones automáticamente
   */
  @Post('process')
  async processMLInsights(@Request() req: any) {
    const storeId = req.user.storeId;

    // Programar procesamiento asíncrono
    await this.queueManagerService.scheduleMLInsightsProcessing(storeId);

    return {
      success: true,
      message: 'ML insights processing scheduled',
    };
  }

  /**
   * Procesa insights inmediatamente (sin cola)
   */
  @Post('process/immediate')
  async processMLInsightsImmediate(@Request() req: any) {
    const storeId = req.user.storeId;
    const count = await this.orchestratorService.processMLInsights(storeId);

    return {
      success: true,
      notificationsCreated: count,
      message: `Created ${count} notifications from ML insights`,
    };
  }

  /**
   * Genera digest diario
   */
  @Post('digest/generate')
  async generateDailyDigest(@Request() req: any) {
    const storeId = req.user.storeId;
    await this.orchestratorService.generateDailyDigest(storeId);

    return {
      success: true,
      message: 'Daily digest generated and sent',
    };
  }

  /**
   * Obtiene métricas de engagement
   */
  @Get('analytics/engagement')
  async getEngagementMetrics(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const storeId = req.user.storeId;

    const dateRange =
      from && to
        ? {
            from: new Date(from),
            to: new Date(to),
          }
        : undefined;

    const metrics = await this.analyticsService.getEngagementMetrics(
      storeId,
      dateRange,
    );

    return {
      success: true,
      metrics,
    };
  }

  /**
   * Obtiene performance por canal
   */
  @Get('analytics/channels')
  async getChannelPerformance(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const storeId = req.user.storeId;

    const dateRange =
      from && to
        ? {
            from: new Date(from),
            to: new Date(to),
          }
        : undefined;

    const channels = await this.analyticsService.getChannelPerformance(
      storeId,
      dateRange,
    );

    return {
      success: true,
      channels,
    };
  }

  /**
   * Obtiene métricas de ML insights
   */
  @Get('analytics/ml-insights')
  async getMLInsightMetrics(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const storeId = req.user.storeId;

    const dateRange =
      from && to
        ? {
            from: new Date(from),
            to: new Date(to),
          }
        : undefined;

    const metrics = await this.analyticsService.getMLInsightMetrics(
      storeId,
      dateRange,
    );

    return {
      success: true,
      metrics,
    };
  }

  /**
   * Obtiene top notificaciones por engagement
   */
  @Get('analytics/top-performing')
  async getTopPerforming(@Request() req: any, @Query('limit') limit?: string) {
    const storeId = req.user.storeId;
    const notifications =
      await this.analyticsService.getTopPerformingNotifications(
        storeId,
        limit ? parseInt(limit) : 10,
      );

    return {
      success: true,
      notifications,
    };
  }

  /**
   * Obtiene tendencias de engagement
   */
  @Get('analytics/trends')
  async getEngagementTrends(@Request() req: any, @Query('days') days?: string) {
    const storeId = req.user.storeId;
    const trends = await this.analyticsService.getEngagementTrends(
      storeId,
      days ? parseInt(days) : 30,
    );

    return {
      success: true,
      trends,
    };
  }

  /**
   * Registra interacción de usuario
   */
  @Post('analytics/interaction')
  async recordInteraction(
    @Request() req: any,
    @Body()
    body: {
      notificationId: string;
      type: 'opened' | 'clicked' | 'dismissed' | 'action';
      actionTaken?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const userId = req.user.sub;

    await this.analyticsService.recordInteraction({
      notificationId: body.notificationId,
      userId,
      interactionType: body.type,
      actionTaken: body.actionTaken,
      metadata: body.metadata,
    });

    return {
      success: true,
      message: 'Interaction recorded',
    };
  }

  /**
   * Lista templates disponibles
   */
  @Get('templates')
  async listTemplates(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    const storeId = req.user.storeId;

    const templates = await this.templateService.listTemplates({
      storeId,
      templateType: type,
      category,
    });

    return {
      success: true,
      total: templates.length,
      templates,
    };
  }

  /**
   * Obtiene estadísticas de cola de emails
   */
  @Get('email/stats')
  async getEmailStats(@Request() req: any) {
    const storeId = req.user.storeId;
    const stats = await this.emailService.getQueueStats(storeId);

    return {
      success: true,
      stats,
    };
  }

  /**
   * Obtiene estadísticas de queue manager
   */
  @Get('queue/stats')
  async getQueueStats() {
    const stats = await this.queueManagerService.getQueueStats();

    return {
      success: true,
      stats,
    };
  }

  /**
   * Obtiene estadísticas de rate limiting para el usuario actual
   */
  @Get('rate-limit/stats')
  async getRateLimitStats(@Request() req: any) {
    const storeId = req.user.storeId;
    const userId = req.user.sub;

    const stats = await this.rateLimiterService.getUserStats(storeId, userId);

    return {
      success: true,
      stats,
    };
  }

  /**
   * Verifica disponibilidad del servicio de email
   */
  @Get('email/status')
  async getEmailServiceStatus() {
    return {
      success: true,
      available: this.emailService.isAvailable(),
    };
  }
}
