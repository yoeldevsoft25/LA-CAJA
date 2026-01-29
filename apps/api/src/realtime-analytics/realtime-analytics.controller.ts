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
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
import { AnalyticsDefaultsService } from './analytics-defaults.service';

@Controller('realtime-analytics')
@UseGuards(JwtAuthGuard)
@Roles('owner', 'cashier') // Allow both owners and cashiers to view metrics
export class RealTimeAnalyticsController {
  private readonly logger = new Logger(RealTimeAnalyticsController.name);

  constructor(
    private readonly analyticsService: RealTimeAnalyticsService,
    private readonly gateway: RealTimeAnalyticsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly analyticsDefaultsService: AnalyticsDefaultsService,
  ) { }

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
   * Eliminar todos los umbrales de la tienda
   */
  @Delete('thresholds')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner')
  async deleteAllThresholds(@Request() req: any) {
    const storeId = req.user.store_id;
    await this.analyticsService.deleteAllThresholds(storeId);
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
        this.logger.error(
          'Error creando notificación desde alerta',
          error instanceof Error ? error.stack : String(error),
        );
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
   * Eliminar todas las alertas de la tienda
   */
  @Delete('alerts')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner')
  async deleteAllAlerts(@Request() req: any) {
    const storeId = req.user.store_id;
    await this.analyticsService.deleteAllAlerts(storeId);
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

  /**
   * Obtener preview de la configuración predeterminada de analíticas
   */
  @Get('defaults/preview')
  getDefaultsPreview() {
    return this.analyticsDefaultsService.getDefaultsPreview();
  }

  /**
   * Verificar si la tienda ya tiene umbrales configurados
   */
  @Get('defaults/has-thresholds')
  async hasExistingThresholds(@Request() req: any) {
    const storeId = req.user.store_id;
    const hasThresholds =
      await this.analyticsDefaultsService.hasExistingThresholds(storeId);
    return { hasThresholds };
  }

  /**
   * Aplicar configuración predeterminada de umbrales de alerta
   */
  @Post('defaults/apply')
  @HttpCode(HttpStatus.OK)
  @Roles('owner') // Solo owners pueden aplicar configuración predeterminada
  async applyDefaultThresholds(@Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;

    try {
      this.logger.log(
        `Aplicando configuración predeterminada para tienda ${storeId}`,
      );

      // Verificar si ya tiene umbrales
      const hasExisting =
        await this.analyticsDefaultsService.hasExistingThresholds(storeId);

      if (hasExisting) {
        this.logger.warn(
          `Tienda ${storeId} ya tiene umbrales configurados. Aplicando defaults igualmente.`,
        );
      }

      // Calcular promedios históricos si existen ventas
      const historicalAverages =
        await this.analyticsDefaultsService.calculateHistoricalAverages(
          storeId,
        );

      // Aplicar configuración predeterminada
      const thresholds = await this.analyticsDefaultsService.applyDefaultThresholds(
        storeId,
        userId,
        historicalAverages || undefined, // Convert null to undefined
      );

      // Iniciar cálculo de métricas inmediatamente
      await this.analyticsService.calculateAndSaveMetrics(storeId);

      this.logger.log(
        `✅ Configuración predeterminada aplicada: ${thresholds.length} umbrales creados`,
      );

      return {
        message: 'Configuración predeterminada aplicada exitosamente',
        thresholds_created: thresholds.length,
        historical_data_used: !!historicalAverages,
        thresholds,
      };
    } catch (error) {
      this.logger.error(
        `Error aplicando defaults para tienda ${storeId}:`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Error aplicando configuración: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
