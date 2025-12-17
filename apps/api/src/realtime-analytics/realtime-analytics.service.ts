import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  RealTimeMetric,
  MetricType,
  PeriodType,
} from '../database/entities/real-time-metric.entity';
import {
  AlertThreshold,
  AlertType,
  ComparisonOperator,
  AlertSeverity,
} from '../database/entities/alert-threshold.entity';
import { RealTimeAlert } from '../database/entities/real-time-alert.entity';
import { SalesHeatmap } from '../database/entities/sales-heatmap.entity';
import {
  ComparativeMetric,
  Trend,
} from '../database/entities/comparative-metric.entity';
import {
  GetMetricsDto,
  MetricType as DtoMetricType,
  PeriodType as DtoPeriodType,
} from './dto/get-metrics.dto';
import { CreateThresholdDto } from './dto/create-threshold.dto';
import { GetAlertsDto } from './dto/get-alerts.dto';
import { GetHeatmapDto } from './dto/get-heatmap.dto';
import { GetComparativeDto, ComparisonPeriod } from './dto/get-comparative.dto';
import { Sale } from '../database/entities/sale.entity';
import { Product } from '../database/entities/product.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class RealTimeAnalyticsService {
  private readonly logger = new Logger(RealTimeAnalyticsService.name);

  constructor(
    @InjectRepository(RealTimeMetric)
    private metricRepository: Repository<RealTimeMetric>,
    @InjectRepository(AlertThreshold)
    private thresholdRepository: Repository<AlertThreshold>,
    @InjectRepository(RealTimeAlert)
    private alertRepository: Repository<RealTimeAlert>,
    @InjectRepository(SalesHeatmap)
    private heatmapRepository: Repository<SalesHeatmap>,
    @InjectRepository(ComparativeMetric)
    private comparativeRepository: Repository<ComparativeMetric>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
  ) {}

  /**
   * Obtener métricas en tiempo real
   */
  async getMetrics(
    storeId: string,
    dto: GetMetricsDto,
  ): Promise<RealTimeMetric[]> {
    const query = this.metricRepository
      .createQueryBuilder('metric')
      .where('metric.store_id = :storeId', { storeId })
      .orderBy('metric.created_at', 'DESC');

    if (dto.metric_type) {
      query.andWhere('metric.metric_type = :metricType', {
        metricType: dto.metric_type,
      });
    }

    if (dto.metric_name) {
      query.andWhere('metric.metric_name = :metricName', {
        metricName: dto.metric_name,
      });
    }

    if (dto.period_type) {
      query.andWhere('metric.period_type = :periodType', {
        periodType: dto.period_type,
      });
    }

    if (dto.start_date) {
      query.andWhere('metric.period_start >= :startDate', {
        startDate: dto.start_date,
      });
    }

    if (dto.end_date) {
      query.andWhere('metric.period_end <= :endDate', {
        endDate: dto.end_date,
      });
    }

    if (dto.limit) {
      query.limit(dto.limit);
    }

    return query.getMany();
  }

  /**
   * Calcular y guardar métricas en tiempo real
   */
  async calculateAndSaveMetrics(storeId: string): Promise<void> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Calcular métricas de ventas del día actual
    const todaySales = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :today', { today })
      .andWhere('sale.status = :status', { status: 'completed' })
      .getMany();

    const todayRevenueBs = todaySales.reduce(
      (sum, sale) => sum + Number(sale.totals?.total_bs || 0),
      0,
    );
    const todayRevenueUsd = todaySales.reduce(
      (sum, sale) => sum + Number(sale.totals?.total_usd || 0),
      0,
    );
    const todaySalesCount = todaySales.length;

    // Calcular métricas de ayer para comparación
    const yesterdaySales = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :yesterday', { yesterday })
      .andWhere('sale.sold_at < :today', { today })
      .andWhere('sale.status = :status', { status: 'completed' })
      .getMany();

    const yesterdayRevenueBs = yesterdaySales.reduce(
      (sum, sale) => sum + Number(sale.totals?.total_bs || 0),
      0,
    );
    const yesterdayRevenueUsd = yesterdaySales.reduce(
      (sum, sale) => sum + Number(sale.totals?.total_usd || 0),
      0,
    );
    const yesterdaySalesCount = yesterdaySales.length;

    // Calcular cambios porcentuales
    const revenueChangeBs =
      yesterdayRevenueBs > 0
        ? ((todayRevenueBs - yesterdayRevenueBs) / yesterdayRevenueBs) * 100
        : 0;
    const revenueChangeUsd =
      yesterdayRevenueUsd > 0
        ? ((todayRevenueUsd - yesterdayRevenueUsd) / yesterdayRevenueUsd) * 100
        : 0;
    const salesCountChange =
      yesterdaySalesCount > 0
        ? ((todaySalesCount - yesterdaySalesCount) / yesterdaySalesCount) * 100
        : 0;

    // Guardar métricas
    const metricsToSave: RealTimeMetric[] = [];

    // Métrica de ingresos BS
    metricsToSave.push(
      this.metricRepository.create({
        id: randomUUID(),
        store_id: storeId,
        metric_type: 'revenue' as MetricType,
        metric_name: 'daily_revenue_bs',
        metric_value: todayRevenueBs,
        previous_value: yesterdayRevenueBs,
        change_percentage: revenueChangeBs,
        period_type: 'day' as PeriodType,
        period_start: today,
        period_end: now,
      }),
    );

    // Métrica de ingresos USD
    metricsToSave.push(
      this.metricRepository.create({
        id: randomUUID(),
        store_id: storeId,
        metric_type: 'revenue' as MetricType,
        metric_name: 'daily_revenue_usd',
        metric_value: todayRevenueUsd,
        previous_value: yesterdayRevenueUsd,
        change_percentage: revenueChangeUsd,
        period_type: 'day' as PeriodType,
        period_start: today,
        period_end: now,
      }),
    );

    // Métrica de cantidad de ventas
    metricsToSave.push(
      this.metricRepository.create({
        id: randomUUID(),
        store_id: storeId,
        metric_type: 'sales' as MetricType,
        metric_name: 'daily_sales_count',
        metric_value: todaySalesCount,
        previous_value: yesterdaySalesCount,
        change_percentage: salesCountChange,
        period_type: 'day' as PeriodType,
        period_start: today,
        period_end: now,
      }),
    );

    // Calcular productos con stock bajo
    const lowStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.current_stock <= product.low_stock_threshold')
      .andWhere('product.low_stock_threshold > 0')
      .getCount();

    metricsToSave.push(
      this.metricRepository.create({
        id: randomUUID(),
        store_id: storeId,
        metric_type: 'inventory' as MetricType,
        metric_name: 'low_stock_products_count',
        metric_value: lowStockProducts,
        previous_value: null,
        change_percentage: null,
        period_type: 'current' as PeriodType,
        period_start: now,
        period_end: now,
      }),
    );

    await this.metricRepository.save(metricsToSave);
  }

  /**
   * Crear umbral de alerta
   */
  async createThreshold(
    storeId: string,
    dto: CreateThresholdDto,
    userId: string,
  ): Promise<AlertThreshold> {
    const threshold = this.thresholdRepository.create({
      id: randomUUID(),
      store_id: storeId,
      alert_type: dto.alert_type,
      metric_name: dto.metric_name,
      threshold_value: dto.threshold_value,
      comparison_operator: dto.comparison_operator,
      severity: dto.severity,
      is_active: dto.is_active ?? true,
      notification_channels: dto.notification_channels ?? ['in_app'],
      created_by: userId,
    });

    return this.thresholdRepository.save(threshold);
  }

  /**
   * Obtener umbrales
   */
  async getThresholds(
    storeId: string,
    activeOnly: boolean = false,
  ): Promise<AlertThreshold[]> {
    const query = this.thresholdRepository
      .createQueryBuilder('threshold')
      .where('threshold.store_id = :storeId', { storeId });

    if (activeOnly) {
      query.andWhere('threshold.is_active = :active', { active: true });
    }

    return query.getMany();
  }

  /**
   * Actualizar umbral
   */
  async updateThreshold(
    storeId: string,
    thresholdId: string,
    updates: Partial<CreateThresholdDto>,
  ): Promise<AlertThreshold> {
    const threshold = await this.thresholdRepository.findOne({
      where: { id: thresholdId, store_id: storeId },
    });

    if (!threshold) {
      throw new NotFoundException('Umbral no encontrado');
    }

    Object.assign(threshold, updates);
    return this.thresholdRepository.save(threshold);
  }

  /**
   * Eliminar umbral
   */
  async deleteThreshold(storeId: string, thresholdId: string): Promise<void> {
    const result = await this.thresholdRepository.delete({
      id: thresholdId,
      store_id: storeId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Umbral no encontrado');
    }
  }

  /**
   * Verificar umbrales y generar alertas
   */
  async checkThresholds(storeId: string): Promise<RealTimeAlert[]> {
    const activeThresholds = await this.getThresholds(storeId, true);
    const alerts: RealTimeAlert[] = [];

    for (const threshold of activeThresholds) {
      try {
        const currentValue = await this.getCurrentMetricValue(
          storeId,
          threshold.metric_name,
        );
        const shouldAlert = this.evaluateThreshold(
          currentValue,
          threshold.threshold_value,
          threshold.comparison_operator,
        );

        if (shouldAlert) {
          // Verificar si ya existe una alerta no leída para este umbral
          const existingAlert = await this.alertRepository.findOne({
            where: {
              store_id: storeId,
              threshold_id: threshold.id,
              is_read: false,
            },
            order: { created_at: 'DESC' },
          });

          // Solo crear nueva alerta si no hay una reciente (última hora)
          if (
            !existingAlert ||
            Date.now() - existingAlert.created_at.getTime() > 3600000
          ) {
            const alert = this.alertRepository.create({
              id: randomUUID(),
              store_id: storeId,
              threshold_id: threshold.id,
              alert_type: threshold.alert_type,
              severity: threshold.severity,
              title: this.generateAlertTitle(
                threshold.alert_type,
                threshold.metric_name,
              ),
              message: this.generateAlertMessage(threshold, currentValue),
              metric_name: threshold.metric_name,
              current_value: currentValue,
              threshold_value: threshold.threshold_value,
            });

            alerts.push(await this.alertRepository.save(alert));
          }
        }
      } catch (error) {
        this.logger.error(
          `Error verificando umbral ${threshold.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return alerts;
  }

  /**
   * Obtener valor actual de una métrica
   */
  private async getCurrentMetricValue(
    storeId: string,
    metricName: string,
  ): Promise<number> {
    // Obtener la métrica más reciente
    const metric = await this.metricRepository.findOne({
      where: { store_id: storeId, metric_name: metricName },
      order: { created_at: 'DESC' },
    });

    if (metric) {
      return Number(metric.metric_value);
    }

    // Si no existe métrica, calcularla dinámicamente
    if (metricName === 'low_stock_products_count') {
      return await this.productRepository
        .createQueryBuilder('product')
        .where('product.store_id = :storeId', { storeId })
        .andWhere('product.current_stock <= product.low_stock_threshold')
        .andWhere('product.low_stock_threshold > 0')
        .getCount();
    }

    if (metricName === 'daily_revenue_bs') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sales = await this.saleRepository
        .createQueryBuilder('sale')
        .where('sale.store_id = :storeId', { storeId })
        .andWhere('sale.sold_at >= :today', { today })
        .andWhere('sale.status = :status', { status: 'completed' })
        .getMany();

      return sales.reduce(
        (sum, sale) => sum + Number(sale.totals?.total_bs || 0),
        0,
      );
    }

    return 0;
  }

  /**
   * Evaluar si un valor cumple con el umbral
   */
  private evaluateThreshold(
    currentValue: number,
    thresholdValue: number,
    operator: ComparisonOperator,
  ): boolean {
    switch (operator) {
      case 'less_than':
        return currentValue < thresholdValue;
      case 'greater_than':
        return currentValue > thresholdValue;
      case 'equals':
        return currentValue === thresholdValue;
      case 'not_equals':
        return currentValue !== thresholdValue;
      default:
        return false;
    }
  }

  /**
   * Generar título de alerta
   */
  private generateAlertTitle(alertType: AlertType, metricName: string): string {
    const titles: Record<AlertType, string> = {
      stock_low: 'Stock Bajo Detectado',
      sale_anomaly: 'Anomalía en Venta Detectada',
      revenue_drop: 'Caída de Ingresos',
      revenue_spike: 'Aumento Inusual de Ingresos',
      inventory_high: 'Inventario Alto',
      debt_overdue: 'Deuda Vencida',
      product_expiring: 'Producto Próximo a Vencer',
      custom: `Alerta: ${metricName}`,
    };

    return titles[alertType] || `Alerta: ${metricName}`;
  }

  /**
   * Generar mensaje de alerta
   */
  private generateAlertMessage(
    threshold: AlertThreshold,
    currentValue: number,
  ): string {
    const operatorText: Record<ComparisonOperator, string> = {
      less_than: 'menor que',
      greater_than: 'mayor que',
      equals: 'igual a',
      not_equals: 'diferente de',
    };

    return `El valor actual de ${threshold.metric_name} (${currentValue}) es ${operatorText[threshold.comparison_operator]} el umbral configurado (${threshold.threshold_value}).`;
  }

  /**
   * Obtener alertas
   */
  async getAlerts(
    storeId: string,
    dto: GetAlertsDto,
  ): Promise<RealTimeAlert[]> {
    const query = this.alertRepository
      .createQueryBuilder('alert')
      .where('alert.store_id = :storeId', { storeId })
      .orderBy('alert.created_at', 'DESC');

    if (dto.alert_type) {
      query.andWhere('alert.alert_type = :alertType', {
        alertType: dto.alert_type,
      });
    }

    if (dto.severity) {
      query.andWhere('alert.severity = :severity', { severity: dto.severity });
    }

    if (dto.is_read !== undefined) {
      query.andWhere('alert.is_read = :isRead', { isRead: dto.is_read });
    }

    if (dto.start_date) {
      query.andWhere('alert.created_at >= :startDate', {
        startDate: dto.start_date,
      });
    }

    if (dto.end_date) {
      query.andWhere('alert.created_at <= :endDate', { endDate: dto.end_date });
    }

    if (dto.limit) {
      query.limit(dto.limit);
    }

    return query.getMany();
  }

  /**
   * Marcar alerta como leída
   */
  async markAlertRead(
    storeId: string,
    alertId: string,
    userId: string,
  ): Promise<RealTimeAlert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId, store_id: storeId },
    });

    if (!alert) {
      throw new NotFoundException('Alerta no encontrada');
    }

    alert.is_read = true;
    alert.read_at = new Date();
    alert.read_by = userId;

    return this.alertRepository.save(alert);
  }

  /**
   * Actualizar heatmap de ventas
   */
  async updateSalesHeatmap(storeId: string, saleDate: Date): Promise<void> {
    const date = new Date(
      saleDate.getFullYear(),
      saleDate.getMonth(),
      saleDate.getDate(),
    );
    const hour = saleDate.getHours();
    const dayOfWeek = saleDate.getDay();

    // Obtener ventas del día
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :start', { start: startOfDay })
      .andWhere('sale.sold_at <= :end', { end: endOfDay })
      .andWhere('sale.status = :status', { status: 'completed' })
      .getMany();

    // Calcular agregaciones por hora
    const hourlyData: Record<
      number,
      { count: number; totalBs: number; totalUsd: number }
    > = {};

    for (const sale of sales) {
      const saleHour = sale.sold_at.getHours();
      if (!hourlyData[saleHour]) {
        hourlyData[saleHour] = { count: 0, totalBs: 0, totalUsd: 0 };
      }
      hourlyData[saleHour].count++;
      hourlyData[saleHour].totalBs += Number(sale.totals?.total_bs || 0);
      hourlyData[saleHour].totalUsd += Number(sale.totals?.total_usd || 0);
    }

    // Guardar o actualizar heatmap
    for (const [hourStr, data] of Object.entries(hourlyData)) {
      const hour = parseInt(hourStr, 10);
      const existing = await this.heatmapRepository.findOne({
        where: { store_id: storeId, date, hour },
      });

      if (existing) {
        existing.sales_count = data.count;
        existing.total_amount_bs = data.totalBs;
        existing.total_amount_usd = data.totalUsd;
        existing.avg_ticket_bs = data.count > 0 ? data.totalBs / data.count : 0;
        existing.avg_ticket_usd =
          data.count > 0 ? data.totalUsd / data.count : 0;
        existing.day_of_week = dayOfWeek;
        await this.heatmapRepository.save(existing);
      } else {
        const heatmap = this.heatmapRepository.create({
          id: randomUUID(),
          store_id: storeId,
          date,
          hour,
          day_of_week: dayOfWeek,
          sales_count: data.count,
          total_amount_bs: data.totalBs,
          total_amount_usd: data.totalUsd,
          avg_ticket_bs: data.count > 0 ? data.totalBs / data.count : 0,
          avg_ticket_usd: data.count > 0 ? data.totalUsd / data.count : 0,
        });
        await this.heatmapRepository.save(heatmap);
      }
    }
  }

  /**
   * Obtener heatmap de ventas
   */
  async getSalesHeatmap(
    storeId: string,
    dto: GetHeatmapDto,
  ): Promise<SalesHeatmap[]> {
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);
    endDate.setHours(23, 59, 59, 999);

    const query = this.heatmapRepository
      .createQueryBuilder('heatmap')
      .where('heatmap.store_id = :storeId', { storeId })
      .andWhere('heatmap.date >= :startDate', { startDate })
      .andWhere('heatmap.date <= :endDate', { endDate })
      .orderBy('heatmap.date', 'ASC')
      .addOrderBy('heatmap.hour', 'ASC');

    if (dto.hour !== undefined) {
      query.andWhere('heatmap.hour = :hour', { hour: dto.hour });
    }

    return query.getMany();
  }

  /**
   * Calcular métricas comparativas
   */
  async calculateComparativeMetrics(
    storeId: string,
    dto: GetComparativeDto,
  ): Promise<ComparativeMetric> {
    const referenceDate = dto.reference_date
      ? new Date(dto.reference_date)
      : new Date();
    let currentPeriodStart = new Date(referenceDate);
    let currentPeriodEnd = new Date(referenceDate);
    let previousPeriodStart = new Date(referenceDate);
    let previousPeriodEnd = new Date(referenceDate);

    // Calcular períodos según el tipo
    switch (dto.period) {
      case ComparisonPeriod.DAY:
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
        previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd.setTime(previousPeriodStart.getTime());
        previousPeriodEnd.setHours(23, 59, 59, 999);
        break;
      case ComparisonPeriod.WEEK:
        const dayOfWeek = referenceDate.getDay();
        currentPeriodStart.setDate(referenceDate.getDate() - dayOfWeek);
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd.setDate(currentPeriodStart.getDate() + 6);
        currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
        previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd.setDate(previousPeriodStart.getDate() + 6);
        previousPeriodEnd.setHours(23, 59, 59, 999);
        break;
      case ComparisonPeriod.MONTH:
        currentPeriodStart.setDate(1);
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = new Date(
          currentPeriodStart.getFullYear(),
          currentPeriodStart.getMonth() + 1,
          0,
        );
        currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart = new Date(
          currentPeriodStart.getFullYear(),
          currentPeriodStart.getMonth() - 1,
          1,
        );
        previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd = new Date(
          previousPeriodStart.getFullYear(),
          previousPeriodStart.getMonth() + 1,
          0,
        );
        previousPeriodEnd.setHours(23, 59, 59, 999);
        break;
      case ComparisonPeriod.YEAR:
        currentPeriodStart = new Date(referenceDate.getFullYear(), 0, 1);
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = new Date(referenceDate.getFullYear(), 11, 31);
        currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart = new Date(referenceDate.getFullYear() - 1, 0, 1);
        previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd = new Date(referenceDate.getFullYear() - 1, 11, 31);
        previousPeriodEnd.setHours(23, 59, 59, 999);
        break;
    }

    // Calcular valores según el tipo de métrica
    let currentValue = 0;
    let previousValue = 0;

    if (
      dto.metric_type === DtoMetricType.REVENUE ||
      dto.metric_type === DtoMetricType.SALES
    ) {
      const currentSales = await this.saleRepository
        .createQueryBuilder('sale')
        .where('sale.store_id = :storeId', { storeId })
        .andWhere('sale.sold_at >= :start', { start: currentPeriodStart })
        .andWhere('sale.sold_at <= :end', { end: currentPeriodEnd })
        .andWhere('sale.status = :status', { status: 'completed' })
        .getMany();

      const previousSales = await this.saleRepository
        .createQueryBuilder('sale')
        .where('sale.store_id = :storeId', { storeId })
        .andWhere('sale.sold_at >= :start', { start: previousPeriodStart })
        .andWhere('sale.sold_at <= :end', { end: previousPeriodEnd })
        .andWhere('sale.status = :status', { status: 'completed' })
        .getMany();

      if (dto.metric_type === DtoMetricType.REVENUE) {
        currentValue = currentSales.reduce(
          (sum, sale) => sum + Number(sale.totals?.total_bs || 0),
          0,
        );
        previousValue = previousSales.reduce(
          (sum, sale) => sum + Number(sale.totals?.total_bs || 0),
          0,
        );
      } else {
        currentValue = currentSales.length;
        previousValue = previousSales.length;
      }
    }

    const changeAmount = currentValue - previousValue;
    const changePercentage =
      previousValue > 0 ? (changeAmount / previousValue) * 100 : 0;
    const trend: Trend =
      changePercentage > 5
        ? 'increasing'
        : changePercentage < -5
          ? 'decreasing'
          : 'stable';

    // Mapear el tipo de métrica del DTO al tipo de la entidad
    const entityMetricType =
      dto.metric_type === DtoMetricType.SALES
        ? ('sales' as const)
        : dto.metric_type === DtoMetricType.REVENUE
          ? ('revenue' as const)
          : ('sales' as const);

    const metric = this.comparativeRepository.create({
      id: randomUUID(),
      store_id: storeId,
      metric_type: entityMetricType,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      previous_period_start: previousPeriodStart,
      previous_period_end: previousPeriodEnd,
      current_value: currentValue,
      previous_value: previousValue,
      change_amount: changeAmount,
      change_percentage: changePercentage,
      trend,
    });

    return this.comparativeRepository.save(metric);
  }

  /**
   * Obtener métricas comparativas guardadas
   */
  async getComparativeMetrics(
    storeId: string,
    metricType?: DtoMetricType,
    limit: number = 10,
  ): Promise<ComparativeMetric[]> {
    const query = this.comparativeRepository
      .createQueryBuilder('metric')
      .where('metric.store_id = :storeId', { storeId })
      .orderBy('metric.calculated_at', 'DESC')
      .limit(limit);

    if (metricType) {
      query.andWhere('metric.metric_type = :metricType', { metricType });
    }

    return query.getMany();
  }
}
