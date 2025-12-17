import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RealTimeAnalyticsService } from './realtime-analytics.service';
import { GetMetricsDto } from './dto/get-metrics.dto';
import { CreateThresholdDto } from './dto/create-threshold.dto';
import { GetAlertsDto } from './dto/get-alerts.dto';
import { MarkAlertReadDto } from './dto/mark-alert-read.dto';
import { GetHeatmapDto } from './dto/get-heatmap.dto';
import { GetComparativeDto } from './dto/get-comparative.dto';
import { RealTimeAnalyticsGateway } from './realtime-analytics.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('realtime-analytics')
@UseGuards(JwtAuthGuard)
export class RealTimeAnalyticsController {
  constructor(
    private readonly analyticsService: RealTimeAnalyticsService,
    private readonly gateway: RealTimeAnalyticsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Obtener métricas en tiempo real
   */
  @Get('metrics')
  async getMetrics(@Request() req: any, @Query() dto: GetMetricsDto) {
    const storeId = req.user.store_id;
    return this.analyticsService.getMetrics(storeId, dto);
  }

  /**
   * Calcular y guardar métricas (endpoint para triggers manuales o cron)
   */
  @Post('metrics/calculate')
  @HttpCode(HttpStatus.OK)
  async calculateMetrics(@Request() req: any) {
    const storeId = req.user.store_id;
    await this.analyticsService.calculateAndSaveMetrics(storeId);
    return { message: 'Métricas calculadas exitosamente' };
  }

  /**
   * Obtener umbrales de alertas
   */
  @Get('thresholds')
  async getThresholds(
    @Request() req: any,
    @Query('active_only') activeOnly?: string,
  ) {
    const storeId = req.user.store_id;
    return this.analyticsService.getThresholds(storeId, activeOnly === 'true');
  }

  /**
   * Crear umbral de alerta
   */
  @Post('thresholds')
  async createThreshold(@Request() req: any, @Body() dto: CreateThresholdDto) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.analyticsService.createThreshold(storeId, dto, userId);
  }

  /**
   * Actualizar umbral
   */
  @Put('thresholds/:id')
  async updateThreshold(
    @Request() req: any,
    @Param('id') thresholdId: string,
    @Body() dto: Partial<CreateThresholdDto>,
  ) {
    const storeId = req.user.store_id;
    return this.analyticsService.updateThreshold(storeId, thresholdId, dto);
  }

  /**
   * Eliminar umbral
   */
  @Delete('thresholds/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteThreshold(@Request() req: any, @Param('id') thresholdId: string) {
    const storeId = req.user.store_id;
    await this.analyticsService.deleteThreshold(storeId, thresholdId);
  }

  /**
   * Verificar umbrales y generar alertas
   */
  @Post('thresholds/check')
  @HttpCode(HttpStatus.OK)
  async checkThresholds(@Request() req: any) {
    const storeId = req.user.store_id;
    const alerts = await this.analyticsService.checkThresholds(storeId);

    // Emitir alertas nuevas a través de WebSocket
    for (const alert of alerts) {
      this.gateway.emitNewAlert(storeId, alert);

      // Crear notificación desde alerta
      try {
        const notification = await this.notificationsService.createFromAlert(
          storeId,
          alert,
        );

        // Emitir vía WebSocket de notificaciones
        if (alert.entity_type && alert.entity_id) {
          // Notificación específica para el usuario relacionado
          // Por ahora emitir a todo el store
          this.notificationsGateway.emitToStore(storeId, notification);
        } else {
          this.notificationsGateway.emitToStore(storeId, notification);
        }
      } catch (error) {
        // Log error pero no fallar el proceso
        console.error('Error creando notificación desde alerta', error);
      }
    }

    return { alerts, count: alerts.length };
  }

  /**
   * Obtener alertas
   */
  @Get('alerts')
  async getAlerts(@Request() req: any, @Query() dto: GetAlertsDto) {
    const storeId = req.user.store_id;
    return this.analyticsService.getAlerts(storeId, dto);
  }

  /**
   * Marcar alerta como leída
   */
  @Post('alerts/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAlertRead(@Request() req: any, @Param('id') alertId: string) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.analyticsService.markAlertRead(storeId, alertId, userId);
  }

  /**
   * Obtener heatmap de ventas
   */
  @Get('heatmap')
  async getSalesHeatmap(@Request() req: any, @Query() dto: GetHeatmapDto) {
    const storeId = req.user.store_id;
    return this.analyticsService.getSalesHeatmap(storeId, dto);
  }

  /**
   * Calcular métricas comparativas
   */
  @Post('comparative')
  async calculateComparative(
    @Request() req: any,
    @Body() dto: GetComparativeDto,
  ) {
    const storeId = req.user.store_id;
    return this.analyticsService.calculateComparativeMetrics(storeId, dto);
  }

  /**
   * Obtener métricas comparativas guardadas
   */
  @Get('comparative')
  async getComparative(
    @Request() req: any,
    @Query('metric_type') metricType?: string,
    @Query('limit') limit?: string,
  ) {
    const storeId = req.user.store_id;
    return this.analyticsService.getComparativeMetrics(
      storeId,
      metricType as any,
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
