import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In, MoreThan } from 'typeorm';
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
import { Store } from '../database/entities/store.entity';
import { Debt } from '../database/entities/debt.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { Shift } from '../database/entities/shift.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Customer } from '../database/entities/customer.entity';
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
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(ProductLot)
    private lotRepository: Repository<ProductLot>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) { }

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyMetrics() {
    this.logger.log('Iniciando cálculo de métricas de ventas (cada hora)...');
    await this.processStoresMetrics('sales');
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleInventoryMetrics() {
    this.logger.log('Iniciando cálculo de métricas de inventario (cada 2 horas)...');
    await this.processStoresMetrics('inventory');
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleDebtMetrics() {
    this.logger.log('Iniciando cálculo de métricas de deudas (cada 6 horas)...');
    await this.processStoresMetrics('debt');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyMetrics() {
    this.logger.log('Iniciando cálculo de métricas diarias...');
    await this.processStoresMetrics('daily');
  }

  private async processStoresMetrics(category: 'sales' | 'inventory' | 'debt' | 'daily') {
    try {
      const stores = await this.storeRepository.find({ where: { license_status: 'active' } });
      for (const store of stores) {
        try {
          switch (category) {
            case 'sales': await this.calculateSalesMetrics(store.id); break;
            case 'inventory': await this.calculateInventoryMetrics(store.id); break;
            case 'debt': await this.calculateCustomerDebtMetrics(store.id); break;
            case 'daily': await this.calculateDailyAggregates(store.id); break;
          }
          await this.checkThresholds(store.id);
        } catch (error) {
          this.logger.error(`Error procesando ${category} para tienda ${store.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Error fatal en job de ${category}:`, error);
    }
  }

  async getMetrics(storeId: string, dto: GetMetricsDto): Promise<RealTimeMetric[]> {
    const query = this.metricRepository.createQueryBuilder('metric').where('metric.store_id = :storeId', { storeId }).orderBy('metric.created_at', 'DESC');
    if (dto.metric_type) query.andWhere('metric.metric_type = :metricType', { metricType: dto.metric_type });
    if (dto.metric_name) query.andWhere('metric.metric_name = :metricName', { metricName: dto.metric_name });
    if (dto.period_type) query.andWhere('metric.period_type = :periodType', { periodType: dto.period_type });
    if (dto.start_date) query.andWhere('metric.period_start >= :startDate', { startDate: dto.start_date });
    if (dto.end_date) query.andWhere('metric.period_end <= :endDate', { endDate: dto.end_date });
    if (dto.limit) query.limit(dto.limit);
    return query.getMany();
  }

  async calculateAndSaveMetrics(storeId: string): Promise<void> {
    await this.calculateSalesMetrics(storeId);
    await this.calculateInventoryMetrics(storeId);
    await this.calculateCustomerDebtMetrics(storeId);
    await this.calculateDailyAggregates(storeId);
  }

  async calculateSalesMetrics(storeId: string): Promise<void> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todaySales = await this.saleRepository.find({
      where: { store_id: storeId, sold_at: MoreThanOrEqual(today) },
      relations: ['items'],
    });

    const yesterdaySales = await this.saleRepository.find({
      where: { store_id: storeId, sold_at: Between(yesterday, new Date(today.getTime() - 1)) },
    });

    const filteredTodaySales = todaySales.filter(s => !s.voided_at);
    const filteredYesterdaySales = yesterdaySales.filter(s => !s.voided_at);

    const metricsToSave: RealTimeMetric[] = [];
    const todayRevBs = filteredTodaySales.reduce((sum, s) => sum + Number(s.totals?.total_bs || 0), 0);
    const todayRevUsd = filteredTodaySales.reduce((sum, s) => sum + Number(s.totals?.total_usd || 0), 0);
    const yesterdayRevBs = filteredYesterdaySales.reduce((sum, s) => sum + Number(s.totals?.total_bs || 0), 0);
    const yesterdayRevUsd = filteredYesterdaySales.reduce((sum, s) => sum + Number(s.totals?.total_usd || 0), 0);

    metricsToSave.push(this.createMetric(storeId, 'revenue', 'daily_revenue_bs', todayRevBs, yesterdayRevBs, 'day', today, now));
    metricsToSave.push(this.createMetric(storeId, 'revenue', 'daily_revenue_usd', todayRevUsd, yesterdayRevUsd, 'day', today, now));

    const todayAvgBs = filteredTodaySales.length > 0 ? todayRevBs / filteredTodaySales.length : 0;
    const todayAvgUsd = filteredTodaySales.length > 0 ? todayRevUsd / filteredTodaySales.length : 0;
    const yesterdayAvgBs = filteredYesterdaySales.length > 0 ? yesterdayRevBs / filteredYesterdaySales.length : 0;
    const yesterdayAvgUsd = filteredYesterdaySales.length > 0 ? yesterdayRevUsd / filteredYesterdaySales.length : 0;

    metricsToSave.push(this.createMetric(storeId, 'sales', 'avg_ticket_bs', todayAvgBs, yesterdayAvgBs, 'day', today, now));
    metricsToSave.push(this.createMetric(storeId, 'sales', 'avg_ticket_usd', todayAvgUsd, yesterdayAvgUsd, 'day', today, now));
    metricsToSave.push(this.createMetric(storeId, 'sales', 'daily_sales_count', filteredTodaySales.length, filteredYesterdaySales.length, 'day', today, now));

    const todayProducts = filteredTodaySales.reduce((sum, s) => sum + s.items.reduce((iSum, item) => iSum + Number(item.qty), 0), 0);
    metricsToSave.push(this.createMetric(storeId, 'sales', 'products_sold_count', todayProducts, null, 'day', today, now));

    await this.metricRepository.save(metricsToSave);
  }

  async calculateInventoryMetrics(storeId: string): Promise<void> {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('inventory_movements', 'movement', 'movement.product_id = product.id AND movement.store_id = product.store_id')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.is_active = true')
      .select('product.id, product.low_stock_threshold, product.cost_bs')
      .addSelect('COALESCE(SUM(movement.qty_delta), 0)', 'current_stock')
      .groupBy('product.id')
      .getRawMany();

    const lowStock = products.filter(p => Number(p.current_stock) > 0 && Number(p.current_stock) <= p.low_stock_threshold).length;
    const outOfStock = products.filter(p => Number(p.current_stock) <= 0).length;
    const invValueBs = products.reduce((sum, p) => sum + (Number(p.current_stock) * Number(p.cost_bs || 0)), 0);

    const expiringSoon = await this.lotRepository.count({
      where: { product: { store_id: storeId }, expiration_date: Between(now, thirtyDaysFromNow), remaining_quantity: MoreThan(0) },
    });

    const expired = await this.lotRepository.count({
      where: { product: { store_id: storeId }, expiration_date: LessThanOrEqual(now), remaining_quantity: MoreThan(0) },
    });

    const metricsToSave = [
      this.createMetric(storeId, 'inventory', 'low_stock_count', lowStock, null, 'current', now, now),
      this.createMetric(storeId, 'inventory', 'out_of_stock_count', outOfStock, null, 'current', now, now),
      this.createMetric(storeId, 'inventory', 'inventory_value_bs', invValueBs, null, 'current', now, now),
      this.createMetric(storeId, 'inventory', 'expiring_soon_count', expiringSoon, null, 'current', now, now),
      this.createMetric(storeId, 'inventory', 'expired_products_count', expired, null, 'current', now, now),
    ];
    await this.metricRepository.save(metricsToSave);
  }

  async calculateCustomerDebtMetrics(storeId: string): Promise<void> {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeCustomers = await this.saleRepository
      .createQueryBuilder('sale')
      .select('DISTINCT(sale.customer_id)')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('sale.customer_id IS NOT NULL')
      .getRawMany();

    const balanceView = await this.debtRepository.query(
      `SELECT SUM(balance_bs) as total_debt_bs, COUNT(DISTINCT customer_id) as debtor_count 
       FROM customer_debt_balance WHERE store_id = $1`,
      [storeId]
    );

    const totalDebtBs = Number(balanceView[0]?.total_debt_bs || 0);
    const debtorCount = Number(balanceView[0]?.debtor_count || 0);

    const metricsToSave = [
      this.createMetric(storeId, 'customers', 'active_customers_count', activeCustomers.length, null, 'day', thirtyDaysAgo, now),
      this.createMetric(storeId, 'debt', 'total_debt_bs', totalDebtBs, null, 'current', now, now),
      this.createMetric(storeId, 'debt', 'overdue_debt_bs', totalDebtBs * 0.15, null, 'current', now, now), // Estimado inicial hasta tener due_at
      this.createMetric(storeId, 'debt', 'customers_overdue_count', debtorCount, null, 'current', now, now),
    ];
    await this.metricRepository.save(metricsToSave);
  }

  async calculateDailyAggregates(storeId: string): Promise<void> {
    const now = new Date();
    const openShifts = await this.shiftRepository.find({ where: { store_id: storeId, status: 'open' as any } });
    const cashOnHandBs = openShifts.reduce((sum, s) => sum + Number(s.opening_amount_bs || 0) + Number(s.expected_totals?.cash_bs || 0), 0);

    const activeSessions = openShifts.length;
    const pendingOrders = await this.purchaseOrderRepository.count({
      where: { store_id: storeId, status: In(['draft', 'sent', 'confirmed', 'partial']) },
    });

    const metricsToSave = [
      this.createMetric(storeId, 'sales', 'active_sessions_count', activeSessions, null, 'current', now, now),
      this.createMetric(storeId, 'purchases', 'pending_orders_count', pendingOrders, null, 'current', now, now),
      this.createMetric(storeId, 'sales', 'cash_on_hand_bs', cashOnHandBs, null, 'current', now, now),
    ];
    await this.metricRepository.save(metricsToSave);
  }

  private createMetric(storeId: string, type: MetricType, name: string, value: number, prevValue: number | null, period: PeriodType, start: Date, end: Date): RealTimeMetric {
    const change = prevValue && prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null;
    return this.metricRepository.create({
      id: randomUUID(), store_id: storeId, metric_type: type, metric_name: name, metric_value: value,
      previous_value: prevValue, change_percentage: change, period_type: period, period_start: start, period_end: end
    });
  }

  async createThreshold(storeId: string, dto: CreateThresholdDto, userId: string): Promise<AlertThreshold> {
    const threshold = this.thresholdRepository.create({
      id: randomUUID(), store_id: storeId, alert_type: dto.alert_type, metric_name: dto.metric_name,
      threshold_value: dto.threshold_value, comparison_operator: dto.comparison_operator, severity: dto.severity,
      is_active: dto.is_active ?? true, notification_channels: dto.notification_channels ?? ['in_app'], created_by: userId,
    });
    return this.thresholdRepository.save(threshold);
  }

  async getThresholds(storeId: string, activeOnly: boolean = false): Promise<AlertThreshold[]> {
    const query = this.thresholdRepository.createQueryBuilder('threshold').where('threshold.store_id = :storeId', { storeId });
    if (activeOnly) query.andWhere('threshold.is_active = :active', { active: true });
    return query.getMany();
  }

  async updateThreshold(storeId: string, thresholdId: string, updates: Partial<CreateThresholdDto>): Promise<AlertThreshold> {
    const threshold = await this.thresholdRepository.findOne({ where: { id: thresholdId, store_id: storeId } });
    if (!threshold) throw new NotFoundException('Umbral no encontrado');
    Object.assign(threshold, updates);
    return this.thresholdRepository.save(threshold);
  }

  async deleteThreshold(storeId: string, thresholdId: string): Promise<void> {
    const result = await this.thresholdRepository.delete({ id: thresholdId, store_id: storeId });
    if (result.affected === 0) throw new NotFoundException('Umbral no encontrado');
  }

  async deleteAllThresholds(storeId: string): Promise<void> {
    await this.thresholdRepository.delete({ store_id: storeId });
  }

  async checkThresholds(storeId: string): Promise<RealTimeAlert[]> {
    const activeThresholds = await this.getThresholds(storeId, true);
    const alerts: RealTimeAlert[] = [];
    for (const threshold of activeThresholds) {
      try {
        const currentValue = await this.getCurrentMetricValue(storeId, threshold.metric_name);
        if (this.evaluateThreshold(currentValue, threshold.threshold_value, threshold.comparison_operator)) {
          const existingAlert = await this.alertRepository.findOne({
            where: { store_id: storeId, threshold_id: threshold.id, is_read: false },
            order: { created_at: 'DESC' },
          });
          if (!existingAlert || Date.now() - existingAlert.created_at.getTime() > 3600000) {
            const alert = this.alertRepository.create({
              id: randomUUID(), store_id: storeId, threshold_id: threshold.id, alert_type: threshold.alert_type,
              severity: threshold.severity, title: this.generateAlertTitle(threshold.alert_type, threshold.metric_name),
              message: this.generateAlertMessage(threshold, currentValue), metric_name: threshold.metric_name,
              current_value: currentValue, threshold_value: threshold.threshold_value,
            });
            alerts.push(await this.alertRepository.save(alert));
          }
        }
      } catch (error) {
        this.logger.error(`Error verificando umbral ${threshold.id}`, error);
      }
    }
    return alerts;
  }

  private async getCurrentMetricValue(storeId: string, metricName: string): Promise<number> {
    const metric = await this.metricRepository.findOne({ where: { store_id: storeId, metric_name: metricName }, order: { created_at: 'DESC' } });
    return metric ? Number(metric.metric_value) : 0;
  }

  private evaluateThreshold(currentValue: number, thresholdValue: number, operator: ComparisonOperator): boolean {
    switch (operator) {
      case 'less_than': return currentValue < thresholdValue;
      case 'greater_than': return currentValue > thresholdValue;
      case 'equals': return currentValue === thresholdValue;
      case 'not_equals': return currentValue !== thresholdValue;
      default: return false;
    }
  }

  private generateAlertTitle(alertType: AlertType, metricName: string): string {
    const titles: Record<AlertType, string> = {
      stock_low: 'Stock Bajo Detectado', sale_anomaly: 'Anomalía en Venta Detectada', revenue_drop: 'Caída de Ingresos',
      revenue_spike: 'Aumento Inusual de Ingresos', inventory_high: 'Inventario Alto', debt_overdue: 'Deuda Vencida',
      product_expiring: 'Producto Próximo a Vencer', custom: `Alerta: ${metricName}`,
    };
    return titles[alertType] || `Alerta: ${metricName}`;
  }

  private generateAlertMessage(threshold: AlertThreshold, currentValue: number): string {
    const operatorText: Record<ComparisonOperator, string> = {
      less_than: 'menor que', greater_than: 'mayor que', equals: 'igual a', not_equals: 'diferente de',
    };
    return `El valor actual de ${threshold.metric_name} (${currentValue}) es ${operatorText[threshold.comparison_operator]} el umbral configurado (${threshold.threshold_value}).`;
  }

  async getAlerts(storeId: string, dto: GetAlertsDto): Promise<RealTimeAlert[]> {
    const query = this.alertRepository.createQueryBuilder('alert').where('alert.store_id = :storeId', { storeId }).orderBy('alert.created_at', 'DESC');
    if (dto.alert_type) query.andWhere('alert.alert_type = :alertType', { alertType: dto.alert_type });
    if (dto.severity) query.andWhere('alert.severity = :severity', { severity: dto.severity });
    if (dto.is_read !== undefined) query.andWhere('alert.is_read = :isRead', { isRead: dto.is_read });
    if (dto.start_date) query.andWhere('alert.created_at >= :startDate', { startDate: dto.start_date });
    if (dto.end_date) query.andWhere('alert.created_at <= :endDate', { endDate: dto.end_date });
    if (dto.limit) query.limit(dto.limit);
    return query.getMany();
  }

  async markAlertRead(storeId: string, alertId: string, userId: string): Promise<RealTimeAlert> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId, store_id: storeId } });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    alert.is_read = true; alert.read_at = new Date(); alert.read_by = userId;
    return this.alertRepository.save(alert);
  }

  async deleteAllAlerts(storeId: string): Promise<void> {
    await this.alertRepository.delete({ store_id: storeId });
  }

  async updateSalesHeatmap(storeId: string, saleDate: Date): Promise<void> {
    const date = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
    const dayOfWeek = saleDate.getDay();
    const startOfDay = new Date(date);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const sales = await this.saleRepository.createQueryBuilder('sale').where('sale.store_id = :storeId', { storeId }).andWhere('sale.sold_at >= :start', { start: startOfDay }).andWhere('sale.sold_at <= :end', { end: endOfDay }).getMany();

    const hourlyData: Record<number, { count: number; totalBs: number; totalUsd: number }> = {};
    for (const sale of sales) {
      const saleHour = sale.sold_at.getHours();
      if (!hourlyData[saleHour]) hourlyData[saleHour] = { count: 0, totalBs: 0, totalUsd: 0 };
      hourlyData[saleHour].count++;
      hourlyData[saleHour].totalBs += Number(sale.totals?.total_bs || 0);
      hourlyData[saleHour].totalUsd += Number(sale.totals?.total_usd || 0);
    }

    for (const [hourStr, data] of Object.entries(hourlyData)) {
      const hour = parseInt(hourStr, 10);
      const existing = await this.heatmapRepository.findOne({ where: { store_id: storeId, date, hour } });
      if (existing) {
        existing.sales_count = data.count; existing.total_amount_bs = data.totalBs; existing.total_amount_usd = data.totalUsd;
        existing.avg_ticket_bs = data.count > 0 ? data.totalBs / data.count : 0;
        existing.avg_ticket_usd = data.count > 0 ? data.totalUsd / data.count : 0;
        existing.day_of_week = dayOfWeek; await this.heatmapRepository.save(existing);
      } else {
        const heatmap = this.heatmapRepository.create({
          id: randomUUID(), store_id: storeId, date, hour, day_of_week: dayOfWeek, sales_count: data.count,
          total_amount_bs: data.totalBs, total_amount_usd: data.totalUsd, avg_ticket_bs: data.count > 0 ? data.totalBs / data.count : 0, avg_ticket_usd: data.count > 0 ? data.totalUsd / data.count : 0,
        });
        await this.heatmapRepository.save(heatmap);
      }
    }
  }

  async getSalesHeatmap(storeId: string, dto: GetHeatmapDto): Promise<SalesHeatmap[]> {
    const startDate = new Date(dto.start_date); const endDate = new Date(dto.end_date); endDate.setHours(23, 59, 59, 999);
    const query = this.heatmapRepository.createQueryBuilder('heatmap').where('heatmap.store_id = :storeId', { storeId }).andWhere('heatmap.date >= :startDate', { startDate }).andWhere('heatmap.date <= :endDate', { endDate }).orderBy('heatmap.date', 'ASC').addOrderBy('heatmap.hour', 'ASC');
    if (dto.hour !== undefined) query.andWhere('heatmap.hour = :hour', { hour: dto.hour });
    return query.getMany();
  }

  async calculateComparativeMetrics(storeId: string, dto: GetComparativeDto): Promise<ComparativeMetric> {
    const referenceDate = dto.reference_date ? new Date(dto.reference_date) : new Date();
    let currentPeriodStart = new Date(referenceDate); let currentPeriodEnd = new Date(referenceDate);
    let previousPeriodStart = new Date(referenceDate); let previousPeriodEnd = new Date(referenceDate);

    switch (dto.period) {
      case ComparisonPeriod.DAY:
        currentPeriodStart.setHours(0, 0, 0, 0); currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 1); previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd.setTime(previousPeriodStart.getTime()); previousPeriodEnd.setHours(23, 59, 59, 999); break;
      case ComparisonPeriod.WEEK:
        const dayOfWeek = referenceDate.getDay(); currentPeriodStart.setDate(referenceDate.getDate() - dayOfWeek); currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd.setDate(currentPeriodStart.getDate() + 6); currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7); previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd.setDate(previousPeriodStart.getDate() + 6); previousPeriodEnd.setHours(23, 59, 59, 999); break;
      case ComparisonPeriod.MONTH:
        currentPeriodStart.setDate(1); currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() + 1, 0); currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() - 1, 1); previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd = new Date(previousPeriodStart.getFullYear(), previousPeriodStart.getMonth() + 1, 0); previousPeriodEnd.setHours(23, 59, 59, 999); break;
      case ComparisonPeriod.YEAR:
        currentPeriodStart = new Date(referenceDate.getFullYear(), 0, 1); currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = new Date(referenceDate.getFullYear(), 11, 31); currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart = new Date(referenceDate.getFullYear() - 1, 0, 1); previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd = new Date(referenceDate.getFullYear() - 1, 11, 31); previousPeriodEnd.setHours(23, 59, 59, 999); break;
    }

    let currentValue = 0; let previousValue = 0;
    if (dto.metric_type === DtoMetricType.REVENUE || dto.metric_type === DtoMetricType.SALES) {
      const currentSales = await this.saleRepository.createQueryBuilder('sale').where('sale.store_id = :storeId', { storeId }).andWhere('sale.sold_at >= :start', { start: currentPeriodStart }).andWhere('sale.sold_at <= :end', { end: currentPeriodEnd }).getMany();
      const previousSales = await this.saleRepository.createQueryBuilder('sale').where('sale.store_id = :storeId', { storeId }).andWhere('sale.sold_at >= :start', { start: previousPeriodStart }).andWhere('sale.sold_at <= :end', { end: previousPeriodEnd }).getMany();
      if (dto.metric_type === DtoMetricType.REVENUE) {
        currentValue = currentSales.reduce((sum, sale) => sum + Number(sale.totals?.total_bs || 0), 0);
        previousValue = previousSales.reduce((sum, sale) => sum + Number(sale.totals?.total_bs || 0), 0);
      } else { currentValue = currentSales.length; previousValue = previousSales.length; }
    }

    const changeAmount = currentValue - previousValue;
    const changePercentage = previousValue > 0 ? (changeAmount / previousValue) * 100 : 0;
    const trend: Trend = changePercentage > 5 ? 'increasing' : changePercentage < -5 ? 'decreasing' : 'stable';
    const entityMetricType = dto.metric_type === DtoMetricType.SALES ? 'sales' : 'revenue';

    const metric = this.comparativeRepository.create({
      id: randomUUID(), store_id: storeId, metric_type: entityMetricType, current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd, previous_period_start: previousPeriodStart, previous_period_end: previousPeriodEnd,
      current_value: currentValue, previous_value: previousValue, change_amount: changeAmount, change_percentage: changePercentage, trend,
    });
    return this.comparativeRepository.save(metric);
  }

  async getComparativeMetrics(storeId: string, metricType?: DtoMetricType, limit: number = 10): Promise<ComparativeMetric[]> {
    const query = this.comparativeRepository.createQueryBuilder('metric').where('metric.store_id = :storeId', { storeId }).orderBy('metric.calculated_at', 'DESC').limit(limit);
    if (metricType) query.andWhere('metric.metric_type = :metricType', { metricType });
    return query.getMany();
  }
}
