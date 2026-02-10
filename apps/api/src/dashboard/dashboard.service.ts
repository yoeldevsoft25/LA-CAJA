import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { Shift } from '../database/entities/shift.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { ExchangeRate } from '../database/entities/exchange-rate.entity';
import { DebtStatus } from '../database/entities/debt.entity';
import { ReportsService } from '../reports/reports.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';

/**
 * Servicio para Dashboard Ejecutivo con KPIs consolidados
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(DebtPayment)
    private debtPaymentRepository: Repository<DebtPayment>,
    @InjectRepository(WarehouseStock)
    private warehouseStockRepository: Repository<WarehouseStock>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(FiscalInvoice)
    private fiscalInvoiceRepository: Repository<FiscalInvoice>,
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(ProductLot)
    private productLotRepository: Repository<ProductLot>,
    @InjectRepository(ExchangeRate)
    private exchangeRateRepository: Repository<ExchangeRate>,
    private reportsService: ReportsService,
    private cache: RedisCacheService,
  ) {}

  /**
   * Obtiene KPIs consolidados para el dashboard
   */
  async getKPIs(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    sales: {
      today_count: number;
      today_amount_bs: number;
      today_amount_usd: number;
      period_count: number;
      period_amount_bs: number;
      period_amount_usd: number;
      growth_percentage: number;
    };
    inventory: {
      total_products: number;
      low_stock_count: number;
      total_stock_value_bs: number;
      total_stock_value_usd: number;
      expiring_soon_count: number;
    };
    finances: {
      total_debt_bs: number;
      total_debt_usd: number;
      total_collected_bs: number;
      total_collected_usd: number;
      pending_collections_bs: number;
      pending_collections_usd: number;
    };
    purchases: {
      pending_orders: number;
      total_purchases_bs: number;
      total_purchases_usd: number;
      completed_orders: number;
    };
    fiscal: {
      issued_invoices: number;
      total_fiscal_amount_bs: number;
      total_fiscal_amount_usd: number;
      total_tax_collected_bs: number;
      total_tax_collected_usd: number;
    };
    performance: {
      avg_sale_amount_bs: number;
      avg_sale_amount_usd: number;
      top_selling_product: {
        id: string;
        name: string;
        quantity_sold: number;
        is_weight_product: boolean;
        weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;
      } | null;
      best_selling_category: string | null;
    };
  }> {
    const cacheKey = `dashboard:kpis:${storeId}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Calcular fechas del período anterior para comparación
    let periodStart: Date;
    let periodEnd: Date;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;

    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(endDate);
      periodEnd.setHours(23, 59, 59, 999);

      const periodDays = Math.ceil(
        (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      previousPeriodEnd = new Date(periodStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
      previousPeriodEnd.setHours(23, 59, 59, 999);
      previousPeriodStart = new Date(previousPeriodEnd);
      previousPeriodStart.setDate(
        previousPeriodStart.getDate() - periodDays + 1,
      );
      previousPeriodStart.setHours(0, 0, 0, 0);
    } else {
      // Por defecto: último mes
      periodEnd = new Date();
      periodEnd.setHours(23, 59, 59, 999);
      periodStart = new Date(periodEnd);
      periodStart.setMonth(periodStart.getMonth() - 1);
      periodStart.setHours(0, 0, 0, 0);

      previousPeriodEnd = new Date(periodStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
      previousPeriodEnd.setHours(23, 59, 59, 999);
      previousPeriodStart = new Date(previousPeriodEnd);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      previousPeriodStart.setHours(0, 0, 0, 0);
    }

    // Ventas: agregaciones en DB (evita traer N filas y sumar en JS)
    const totalsBsExpr =
      "COALESCE((sale.totals->>'total_bs')::numeric, 0)";
    const totalsUsdExpr =
      "COALESCE((sale.totals->>'total_usd')::numeric, 0)";

    const todayAgg = await this.saleRepository
      .createQueryBuilder('sale')
      .select('COUNT(sale.id)', 'count')
      .addSelect(`COALESCE(SUM(${totalsBsExpr}), 0)`, 'sum_bs')
      .addSelect(`COALESCE(SUM(${totalsUsdExpr}), 0)`, 'sum_usd')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere('sale.sold_at >= :start', { start: today })
      .andWhere('sale.sold_at <= :end', { end: todayEnd })
      .getRawOne();

    const periodAgg = await this.saleRepository
      .createQueryBuilder('sale')
      .select('COUNT(sale.id)', 'count')
      .addSelect(`COALESCE(SUM(${totalsBsExpr}), 0)`, 'sum_bs')
      .addSelect(`COALESCE(SUM(${totalsUsdExpr}), 0)`, 'sum_usd')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere('sale.sold_at >= :start', { start: periodStart })
      .andWhere('sale.sold_at <= :end', { end: periodEnd })
      .getRawOne();

    const previousPeriodAgg = await this.saleRepository
      .createQueryBuilder('sale')
      .select(`COALESCE(SUM(${totalsBsExpr}), 0)`, 'sum_bs')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere('sale.sold_at >= :start', { start: previousPeriodStart })
      .andWhere('sale.sold_at <= :end', { end: previousPeriodEnd })
      .getRawOne();

    const todayCount = Number(todayAgg?.count || 0);
    const todayAmountBs = Number(todayAgg?.sum_bs || 0);
    const todayAmountUsd = Number(todayAgg?.sum_usd || 0);

    const periodCount = Number(periodAgg?.count || 0);
    const periodAmountBs = Number(periodAgg?.sum_bs || 0);
    const periodAmountUsd = Number(periodAgg?.sum_usd || 0);

    const previousPeriodAmountBs = Number(previousPeriodAgg?.sum_bs || 0);

    const growthPercentage =
      previousPeriodAmountBs > 0
        ? ((periodAmountBs - previousPeriodAmountBs) / previousPeriodAmountBs) *
          100
        : 0;

    // Inventario
    const totalProducts = await this.productRepository.count({
      where: { store_id: storeId, is_active: true },
    });

    const warehouseStockSubquery = this.warehouseStockRepository
      .createQueryBuilder('stock')
      .select('stock.product_id', 'product_id')
      .addSelect('SUM(stock.stock)', 'current_stock')
      .innerJoin(
        'warehouses',
        'warehouse',
        'warehouse.id = stock.warehouse_id AND warehouse.store_id = :storeId',
        { storeId },
      )
      .groupBy('stock.product_id');

    const lotStockSubquery = this.productLotRepository
      .createQueryBuilder('lot')
      .select('lot.product_id', 'product_id')
      .addSelect('SUM(lot.remaining_quantity)', 'lot_stock')
      .groupBy('lot.product_id');

    const currentStockExpression =
      'CASE WHEN lot_stock.lot_stock IS NOT NULL THEN lot_stock.lot_stock ELSE COALESCE(stock.current_stock, 0) END';

    // Obtener productos con stock bajo usando stock de bodega o lotes
    let lowStockCount = 0;
    try {
      const lowStockProducts = await this.productRepository
        .createQueryBuilder('product')
        .leftJoin(
          `(${warehouseStockSubquery.getQuery()})`,
          'stock',
          'stock.product_id = product.id',
        )
        .leftJoin(
          `(${lotStockSubquery.getQuery()})`,
          'lot_stock',
          'lot_stock.product_id = product.id',
        )
        .setParameters({
          ...warehouseStockSubquery.getParameters(),
          ...lotStockSubquery.getParameters(),
        })
        .where('product.store_id = :storeId', { storeId })
        .andWhere('product.is_active = true')
        .andWhere('product.low_stock_threshold > 0')
        .select('product.id', 'id')
        .addSelect('product.low_stock_threshold', 'low_stock_threshold')
        .addSelect(currentStockExpression, 'current_stock')
        .andWhere(`${currentStockExpression} <= product.low_stock_threshold`)
        .getRawMany();

      lowStockCount = lowStockProducts.length;
    } catch (error) {
      // Si hay error, usar 0 como valor por defecto
      lowStockCount = 0;
    }

    // Calcular valor de inventario.
    // Fuente de verdad para cantidad: stock agregado por bodega.
    // Para costo unitario: promedio ponderado de lotes (si existe), con fallback a costo del producto.
    let totalStockValueBs = 0;
    let totalStockValueUsd = 0;
    try {
      const perWeightFallbackBs = `CASE
        WHEN product.weight_unit = 'g' THEN COALESCE(product.cost_bs, 0) * 0.001
        WHEN product.weight_unit = 'lb' THEN COALESCE(product.cost_bs, 0) * 0.45359237
        WHEN product.weight_unit = 'oz' THEN COALESCE(product.cost_bs, 0) * 0.028349523125
        ELSE COALESCE(product.cost_bs, 0)
      END`;
      const perWeightFallbackUsd = `CASE
        WHEN product.weight_unit = 'g' THEN COALESCE(product.cost_usd, 0) * 0.001
        WHEN product.weight_unit = 'lb' THEN COALESCE(product.cost_usd, 0) * 0.45359237
        WHEN product.weight_unit = 'oz' THEN COALESCE(product.cost_usd, 0) * 0.028349523125
        ELSE COALESCE(product.cost_usd, 0)
      END`;

      const inventoryValuationRows = await this.productRepository
        .createQueryBuilder('product')
        .leftJoin(
          `(${warehouseStockSubquery.getQuery()})`,
          'stock',
          'stock.product_id = product.id',
        )
        .leftJoin(
          'product_lots',
          'lot',
          'lot.product_id = product.id AND lot.remaining_quantity > 0',
        )
        .setParameters(warehouseStockSubquery.getParameters())
        .where('product.store_id = :storeId', { storeId })
        .andWhere('product.is_active = true')
        .select('product.id', 'id')
        .addSelect('COALESCE(stock.current_stock, 0)', 'stock')
        .addSelect(
          `CASE
            WHEN product.is_weight_product = true THEN
              COALESCE(product.cost_per_weight_bs, ${perWeightFallbackBs})
            ELSE
              CASE
                WHEN COALESCE(SUM(lot.remaining_quantity), 0) > 0 THEN COALESCE(
                  SUM(lot.remaining_quantity * lot.unit_cost_bs) / NULLIF(SUM(lot.remaining_quantity), 0),
                  COALESCE(product.cost_bs, 0)
                )
                ELSE COALESCE(product.cost_bs, 0)
              END
          END`,
          'unit_cost_bs',
        )
        .addSelect(
          `CASE
            WHEN product.is_weight_product = true THEN
              COALESCE(product.cost_per_weight_usd, ${perWeightFallbackUsd})
            ELSE
              CASE
                WHEN COALESCE(SUM(lot.remaining_quantity), 0) > 0 THEN COALESCE(
                  SUM(lot.remaining_quantity * lot.unit_cost_usd) / NULLIF(SUM(lot.remaining_quantity), 0),
                  COALESCE(product.cost_usd, 0)
                )
                ELSE COALESCE(product.cost_usd, 0)
              END
          END`,
          'unit_cost_usd',
        )
        .groupBy('product.id')
        .addGroupBy('stock.current_stock')
        .addGroupBy('product.is_weight_product')
        .addGroupBy('product.weight_unit')
        .addGroupBy('product.cost_per_weight_bs')
        .addGroupBy('product.cost_per_weight_usd')
        .addGroupBy('product.cost_bs')
        .addGroupBy('product.cost_usd')
        .getRawMany();

      for (const row of inventoryValuationRows) {
        const stock = Math.max(parseFloat(row.stock) || 0, 0);
        totalStockValueBs += stock * Number(row.unit_cost_bs || 0);
        totalStockValueUsd += stock * Number(row.unit_cost_usd || 0);
      }

      // Mantener consistencia con BCV actual cuando hay valoración en USD.
      // Si no hay tasa o no hay USD, se conserva el cálculo en Bs por costo base.
      if (totalStockValueUsd > 0) {
        const now = new Date();
        const bcvRateRow = await this.exchangeRateRepository
          .createQueryBuilder('rate')
          .where('rate.store_id = :storeId', { storeId })
          .andWhere('rate.rate_type = :rateType', { rateType: 'BCV' })
          .andWhere('rate.is_active = true')
          .andWhere('rate.effective_from <= :now', { now })
          .andWhere(
            '(rate.effective_until IS NULL OR rate.effective_until > :now)',
            {
              now,
            },
          )
          .orderBy('rate.is_preferred', 'DESC')
          .addOrderBy('rate.effective_from', 'DESC')
          .addOrderBy('rate.updated_at', 'DESC')
          .addOrderBy('rate.created_at', 'DESC')
          .getOne();

        const bcvRate = Number(bcvRateRow?.rate || 0);
        if (bcvRate > 0) {
          totalStockValueBs = totalStockValueUsd * bcvRate;
        }
      }
    } catch (error) {
      // Si hay error, usar 0 como valor por defecto
      totalStockValueBs = 0;
      totalStockValueUsd = 0;
    }

    // Productos próximos a vencer (30 días)
    const expiringSoon = await this.productLotRepository
      .createQueryBuilder('lot')
      .leftJoin('lot.product', 'product')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('lot.expiration_date IS NOT NULL')
      .andWhere('lot.expiration_date <= :expiryDate', {
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .andWhere('lot.expiration_date > :now', { now: new Date() })
      .andWhere('lot.remaining_quantity > 0')
      .getCount();

    // Finanzas (Deudas)
    const openDebtsAgg = await this.debtRepository
      .createQueryBuilder('debt')
      .select('COALESCE(SUM(debt.amount_bs), 0)', 'sum_bs')
      .addSelect('COALESCE(SUM(debt.amount_usd), 0)', 'sum_usd')
      .where('debt.store_id = :storeId', { storeId })
      .andWhere('debt.status = :status', { status: DebtStatus.OPEN })
      .getRawOne();

    const totalDebtBs = Number(openDebtsAgg?.sum_bs || 0);
    const totalDebtUsd = Number(openDebtsAgg?.sum_usd || 0);

    // Pagos recibidos en el período
    const periodPaymentsAgg = await this.debtPaymentRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount_bs), 0)', 'sum_bs')
      .addSelect('COALESCE(SUM(payment.amount_usd), 0)', 'sum_usd')
      .where('payment.store_id = :storeId', { storeId })
      .andWhere('payment.paid_at >= :start', { start: periodStart })
      .andWhere('payment.paid_at <= :end', { end: periodEnd })
      .getRawOne();

    const totalCollectedBs = Number(periodPaymentsAgg?.sum_bs || 0);
    const totalCollectedUsd = Number(periodPaymentsAgg?.sum_usd || 0);

    // Compras
    const pendingOrders = await this.purchaseOrderRepository.count({
      where: {
        store_id: storeId,
        status: In(['draft', 'sent', 'confirmed', 'partial']),
      },
    });

    const completedOrdersAgg = await this.purchaseOrderRepository
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'count')
      .addSelect('COALESCE(SUM(order.total_amount_bs), 0)', 'sum_bs')
      .addSelect('COALESCE(SUM(order.total_amount_usd), 0)', 'sum_usd')
      .where('order.store_id = :storeId', { storeId })
      .andWhere('order.status = :status', { status: 'completed' })
      .andWhere('order.requested_at >= :start', { start: periodStart })
      .andWhere('order.requested_at <= :end', { end: periodEnd })
      .getRawOne();

    const completedOrdersCount = Number(completedOrdersAgg?.count || 0);
    const totalPurchasesBs = Number(completedOrdersAgg?.sum_bs || 0);
    const totalPurchasesUsd = Number(completedOrdersAgg?.sum_usd || 0);

    // Facturación Fiscal
    const issuedInvoicesAgg = await this.fiscalInvoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(invoice.id)', 'count')
      .addSelect('COALESCE(SUM(invoice.total_bs), 0)', 'sum_bs')
      .addSelect('COALESCE(SUM(invoice.total_usd), 0)', 'sum_usd')
      .addSelect('COALESCE(SUM(invoice.tax_amount_bs), 0)', 'tax_sum_bs')
      .addSelect('COALESCE(SUM(invoice.tax_amount_usd), 0)', 'tax_sum_usd')
      .where('invoice.store_id = :storeId', { storeId })
      .andWhere('invoice.status = :status', { status: 'issued' })
      .andWhere('invoice.issued_at IS NOT NULL')
      .andWhere('invoice.issued_at >= :start', { start: periodStart })
      .andWhere('invoice.issued_at <= :end', { end: periodEnd })
      .getRawOne();

    const issuedInvoicesCount = Number(issuedInvoicesAgg?.count || 0);
    const totalFiscalAmountBs = Number(issuedInvoicesAgg?.sum_bs || 0);
    const totalFiscalAmountUsd = Number(issuedInvoicesAgg?.sum_usd || 0);
    const totalTaxCollectedBs = Number(issuedInvoicesAgg?.tax_sum_bs || 0);
    const totalTaxCollectedUsd = Number(issuedInvoicesAgg?.tax_sum_usd || 0);

    // Performance - Producto más vendido
    let topProduct: any = null;
    try {
      topProduct = await this.saleItemRepository
        .createQueryBuilder('item')
        .leftJoin('item.sale', 'sale')
        .leftJoin('item.product', 'product')
        .where('sale.store_id = :storeId', { storeId })
        .andWhere('sale.voided_at IS NULL')
        .andWhere('sale.sold_at >= :start', { start: periodStart })
        .andWhere('sale.sold_at <= :end', { end: periodEnd })
        .select('product.id', 'product_id')
        .addSelect('product.name', 'product_name')
        .addSelect('product.is_weight_product', 'is_weight_product')
        .addSelect('product.weight_unit', 'weight_unit')
        .addSelect('SUM(item.qty)', 'total_quantity')
        .groupBy('product.id')
        .addGroupBy('product.name')
        .orderBy('SUM(item.qty)', 'DESC')
        .limit(1)
        .getRawOne();
    } catch (error) {
      // Si no hay ventas en el período, topProduct será null
      topProduct = null;
    }

    // Performance - Categoría más vendida
    let topCategory: any = null;
    try {
      topCategory = await this.saleItemRepository
        .createQueryBuilder('item')
        .leftJoin('item.sale', 'sale')
        .leftJoin('item.product', 'product')
        .where('sale.store_id = :storeId', { storeId })
        .andWhere('sale.voided_at IS NULL')
        .andWhere('sale.sold_at >= :start', { start: periodStart })
        .andWhere('sale.sold_at <= :end', { end: periodEnd })
        .andWhere('product.category IS NOT NULL')
        .select('product.category', 'category')
        .addSelect('SUM(item.qty)', 'total_quantity')
        .groupBy('product.category')
        .orderBy('SUM(item.qty)', 'DESC')
        .limit(1)
        .getRawOne();
    } catch (error) {
      // Si no hay ventas en el período, topCategory será null
      topCategory = null;
    }

    const avgSaleAmountBs = periodCount > 0 ? periodAmountBs / periodCount : 0;
    const avgSaleAmountUsd =
      periodCount > 0 ? periodAmountUsd / periodCount : 0;

    const result = {
      sales: {
        today_count: todayCount,
        today_amount_bs: todayAmountBs,
        today_amount_usd: todayAmountUsd,
        period_count: periodCount,
        period_amount_bs: periodAmountBs,
        period_amount_usd: periodAmountUsd,
        growth_percentage: growthPercentage,
      },
      inventory: {
        total_products: totalProducts,
        low_stock_count: lowStockCount,
        total_stock_value_bs: totalStockValueBs,
        total_stock_value_usd: totalStockValueUsd,
        expiring_soon_count: expiringSoon,
      },
      finances: {
        total_debt_bs: totalDebtBs,
        total_debt_usd: totalDebtUsd,
        total_collected_bs: totalCollectedBs,
        total_collected_usd: totalCollectedUsd,
        pending_collections_bs: totalDebtBs - totalCollectedBs,
        pending_collections_usd: totalDebtUsd - totalCollectedUsd,
      },
      purchases: {
        pending_orders: pendingOrders,
        total_purchases_bs: totalPurchasesBs,
        total_purchases_usd: totalPurchasesUsd,
        completed_orders: completedOrdersCount,
      },
      fiscal: {
        issued_invoices: issuedInvoicesCount,
        total_fiscal_amount_bs: totalFiscalAmountBs,
        total_fiscal_amount_usd: totalFiscalAmountUsd,
        total_tax_collected_bs: totalTaxCollectedBs,
        total_tax_collected_usd: totalTaxCollectedUsd,
      },
      performance: {
        avg_sale_amount_bs: avgSaleAmountBs,
        avg_sale_amount_usd: avgSaleAmountUsd,
        top_selling_product: topProduct
          ? {
              id: topProduct.product_id,
              name: topProduct.product_name,
              quantity_sold: parseFloat(topProduct.total_quantity) || 0,
              is_weight_product: Boolean(topProduct.is_weight_product),
              weight_unit: topProduct.weight_unit ?? null,
            }
          : null,
        best_selling_category: topCategory?.category || null,
      },
    };

    await this.cache.set(cacheKey, result, 30);
    return result;
  }

  /**
   * Obtiene métricas de tendencias (últimos 7 días)
   */
  async getTrends(storeId: string): Promise<{
    sales_trend: Array<{
      date: string;
      count: number;
      amount_bs: number;
      amount_usd: number;
    }>;
    top_products_trend: Array<{
      product_id: string;
      product_name: string;
      quantity_sold: number;
      revenue_bs: number;
      revenue_usd: number;
      is_weight_product: boolean;
      weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;
    }>;
  }> {
    const cacheKey = `dashboard:trends:${storeId}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    const sales = await this.saleRepository.find({
      where: {
        store_id: storeId,
        sold_at: Between(startDate, endDate),
        voided_at: IsNull(),
      },
    });

    // Tendencias de ventas por día
    const salesByDay = new Map<
      string,
      { count: number; amount_bs: number; amount_usd: number }
    >();

    for (const sale of sales) {
      const dateKey = sale.sold_at.toISOString().split('T')[0];
      if (!salesByDay.has(dateKey)) {
        salesByDay.set(dateKey, { count: 0, amount_bs: 0, amount_usd: 0 });
      }
      const dayData = salesByDay.get(dateKey)!;
      dayData.count++;
      dayData.amount_bs += Number(sale.totals.total_bs);
      dayData.amount_usd += Number(sale.totals.total_usd);
    }

    const salesTrend = Array.from(salesByDay.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top 10 por peso y top 10 por cantidad: una sola query amplia y separación en JS
    // (evita que el filtro SQL por is_weight_product deje fuera productos por tipo/coerción)
    const allTop = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sale', 'sale')
      .leftJoin('item.product', 'product')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere('product.id IS NOT NULL')
      .andWhere('sale.sold_at >= :start', { start: startDate })
      .andWhere('sale.sold_at <= :end', { end: endDate })
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect('product.is_weight_product', 'is_weight_product')
      .addSelect('product.weight_unit', 'weight_unit')
      .addSelect('SUM(item.qty)', 'total_quantity')
      .addSelect(
        'SUM((item.unit_price_bs * item.qty) - COALESCE(item.discount_bs, 0))',
        'total_revenue_bs',
      )
      .addSelect(
        'SUM((item.unit_price_usd * item.qty) - COALESCE(item.discount_usd, 0))',
        'total_revenue_usd',
      )
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.is_weight_product')
      .addGroupBy('product.weight_unit')
      .orderBy('SUM(item.qty)', 'DESC')
      .limit(80)
      .getRawMany();

    const isWeight = (p: { is_weight_product: unknown }) =>
      p.is_weight_product === true ||
      p.is_weight_product === 1 ||
      p.is_weight_product === 't';
    const topByWeight = allTop.filter(isWeight).slice(0, 10);
    const topByUnit = allTop.filter((p) => !isWeight(p)).slice(0, 10);

    const topProductsTrend = [...topByWeight, ...topByUnit].map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      quantity_sold: parseFloat(p.total_quantity) || 0,
      revenue_bs: parseFloat(p.total_revenue_bs) || 0,
      revenue_usd: parseFloat(p.total_revenue_usd) || 0,
      is_weight_product: Boolean(p.is_weight_product),
      weight_unit: p.weight_unit ?? null,
    }));

    const result = {
      sales_trend: salesTrend,
      top_products_trend: topProductsTrend,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }
}
