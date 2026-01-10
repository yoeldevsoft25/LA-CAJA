import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Product } from '../database/entities/product.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { Shift } from '../database/entities/shift.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { DebtStatus } from '../database/entities/debt.entity';
import { ReportsService } from '../reports/reports.service';

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
    @InjectRepository(InventoryMovement)
    private inventoryMovementRepository: Repository<InventoryMovement>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(FiscalInvoice)
    private fiscalInvoiceRepository: Repository<FiscalInvoice>,
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(ProductLot)
    private productLotRepository: Repository<ProductLot>,
    private reportsService: ReportsService,
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
      } | null;
      best_selling_category: string | null;
    };
  }> {
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

    // Ventas de hoy
    const todaySales = await this.saleRepository.find({
      where: {
        store_id: storeId,
        sold_at: Between(today, todayEnd),
        voided_at: IsNull(),
      },
    });

    let todayAmountBs = 0;
    let todayAmountUsd = 0;
    for (const sale of todaySales) {
      todayAmountBs += Number(sale.totals.total_bs);
      todayAmountUsd += Number(sale.totals.total_usd);
    }

    // Ventas del período
    const periodSales = await this.saleRepository.find({
      where: {
        store_id: storeId,
        sold_at: Between(periodStart, periodEnd),
        voided_at: IsNull(),
      },
    });

    let periodAmountBs = 0;
    let periodAmountUsd = 0;
    for (const sale of periodSales) {
      periodAmountBs += Number(sale.totals.total_bs);
      periodAmountUsd += Number(sale.totals.total_usd);
    }

    // Ventas del período anterior (para crecimiento)
    const previousPeriodSales = await this.saleRepository.find({
      where: {
        store_id: storeId,
        sold_at: Between(previousPeriodStart, previousPeriodEnd),
        voided_at: IsNull(),
      },
    });

    let previousPeriodAmountBs = 0;
    for (const sale of previousPeriodSales) {
      previousPeriodAmountBs += Number(sale.totals.total_bs);
    }

    const growthPercentage =
      previousPeriodAmountBs > 0
        ? ((periodAmountBs - previousPeriodAmountBs) / previousPeriodAmountBs) *
          100
        : 0;

    // Inventario
    const totalProducts = await this.productRepository.count({
      where: { store_id: storeId, is_active: true },
    });

    // Obtener productos con stock bajo usando una subconsulta
    let lowStockCount = 0;
    try {
      const lowStockProducts = await this.productRepository
        .createQueryBuilder('product')
        .leftJoin(
          'inventory_movements',
          'movement',
          'movement.product_id = product.id AND movement.store_id = :storeId AND movement.approved = true',
          { storeId },
        )
        .where('product.store_id = :storeId', { storeId })
        .andWhere('product.is_active = true')
        .andWhere('product.low_stock_threshold > 0')
        .select('product.id', 'id')
        .addSelect('product.low_stock_threshold', 'low_stock_threshold')
        .addSelect('COALESCE(SUM(movement.qty_delta), 0)', 'current_stock')
        .groupBy('product.id')
        .addGroupBy('product.low_stock_threshold')
        .having(
          'COALESCE(SUM(movement.qty_delta), 0) <= product.low_stock_threshold',
        )
        .getRawMany();

      lowStockCount = lowStockProducts.length;
    } catch (error) {
      // Si hay error, usar 0 como valor por defecto
      lowStockCount = 0;
    }

    // Calcular valor de inventario (considera productos con y sin lotes)
    let totalStockValueBs = 0;
    let totalStockValueUsd = 0;
    try {
      const lotTotals = await this.productLotRepository
        .createQueryBuilder('lot')
        .leftJoin('lot.product', 'product')
        .where('product.store_id = :storeId', { storeId })
        .andWhere('product.is_active = true')
        .select(
          'COALESCE(SUM(lot.remaining_quantity * lot.unit_cost_bs), 0)',
          'total_bs',
        )
        .addSelect(
          'COALESCE(SUM(lot.remaining_quantity * lot.unit_cost_usd), 0)',
          'total_usd',
        )
        .getRawOne();

      totalStockValueBs += Number(lotTotals?.total_bs || 0);
      totalStockValueUsd += Number(lotTotals?.total_usd || 0);

      const productsWithStock = await this.productRepository
        .createQueryBuilder('product')
        .leftJoin(
          'product_lots',
          'lot',
          'lot.product_id = product.id',
        )
        .leftJoin(
          'inventory_movements',
          'movement',
          'movement.product_id = product.id AND movement.store_id = :storeId AND movement.approved = true',
          { storeId },
        )
        .where('product.store_id = :storeId', { storeId })
        .andWhere('product.is_active = true')
        .andWhere('lot.id IS NULL')
        .select('product.id', 'id')
        .addSelect('product.cost_bs', 'cost_bs')
        .addSelect('product.cost_usd', 'cost_usd')
        .addSelect('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
        .groupBy('product.id')
        .addGroupBy('product.cost_bs')
        .addGroupBy('product.cost_usd')
        .getRawMany();

      for (const product of productsWithStock) {
        const stock = parseFloat(product.stock) || 0;
        totalStockValueBs += stock * Number(product.cost_bs || 0);
        totalStockValueUsd += stock * Number(product.cost_usd || 0);
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
    const openDebts = await this.debtRepository.find({
      where: {
        store_id: storeId,
        status: DebtStatus.OPEN,
      },
    });

    let totalDebtBs = 0;
    let totalDebtUsd = 0;
    for (const debt of openDebts) {
      totalDebtBs += Number(debt.amount_bs);
      totalDebtUsd += Number(debt.amount_usd);
    }

    // Pagos recibidos en el período
    const periodPayments = await this.debtPaymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.debt', 'debt')
      .where('debt.store_id = :storeId', { storeId })
      .andWhere('payment.paid_at >= :start', { start: periodStart })
      .andWhere('payment.paid_at <= :end', { end: periodEnd })
      .getMany();

    let totalCollectedBs = 0;
    let totalCollectedUsd = 0;
    for (const payment of periodPayments) {
      totalCollectedBs += Number(payment.amount_bs);
      totalCollectedUsd += Number(payment.amount_usd);
    }

    // Compras
    const pendingOrders = await this.purchaseOrderRepository.count({
      where: {
        store_id: storeId,
        status: In(['draft', 'sent', 'confirmed', 'partial']),
      },
    });

    const completedOrders = await this.purchaseOrderRepository
      .createQueryBuilder('order')
      .where('order.store_id = :storeId', { storeId })
      .andWhere('order.status = :status', { status: 'completed' })
      .andWhere('order.requested_at >= :start', { start: periodStart })
      .andWhere('order.requested_at <= :end', { end: periodEnd })
      .getMany();

    let totalPurchasesBs = 0;
    let totalPurchasesUsd = 0;
    for (const order of completedOrders) {
      totalPurchasesBs += Number(order.total_amount_bs);
      totalPurchasesUsd += Number(order.total_amount_usd);
    }

    // Facturación Fiscal
    const issuedInvoices = await this.fiscalInvoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.store_id = :storeId', { storeId })
      .andWhere('invoice.status = :status', { status: 'issued' })
      .andWhere('invoice.issued_at IS NOT NULL')
      .andWhere('invoice.issued_at >= :start', { start: periodStart })
      .andWhere('invoice.issued_at <= :end', { end: periodEnd })
      .getMany();

    let totalFiscalAmountBs = 0;
    let totalFiscalAmountUsd = 0;
    let totalTaxCollectedBs = 0;
    let totalTaxCollectedUsd = 0;
    for (const invoice of issuedInvoices) {
      totalFiscalAmountBs += Number(invoice.total_bs);
      totalFiscalAmountUsd += Number(invoice.total_usd);
      totalTaxCollectedBs += Number(invoice.tax_amount_bs);
      totalTaxCollectedUsd += Number(invoice.tax_amount_usd);
    }

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

    const avgSaleAmountBs =
      periodSales.length > 0 ? periodAmountBs / periodSales.length : 0;
    const avgSaleAmountUsd =
      periodSales.length > 0 ? periodAmountUsd / periodSales.length : 0;

    return {
      sales: {
        today_count: todaySales.length,
        today_amount_bs: todayAmountBs,
        today_amount_usd: todayAmountUsd,
        period_count: periodSales.length,
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
        completed_orders: completedOrders.length,
      },
      fiscal: {
        issued_invoices: issuedInvoices.length,
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
              quantity_sold: parseInt(topProduct.total_quantity) || 0,
            }
          : null,
        best_selling_category: topCategory?.category || null,
      },
    };
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
    }>;
  }> {
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

    // Top productos de la semana
    const topProducts = await this.saleItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.sale', 'sale')
      .leftJoin('item.product', 'product')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere('sale.sold_at >= :start', { start: startDate })
      .andWhere('sale.sold_at <= :end', { end: endDate })
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
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
      .orderBy('SUM(item.qty)', 'DESC')
      .limit(10)
      .getRawMany();

    const topProductsTrend = topProducts.map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      quantity_sold: parseInt(p.total_quantity) || 0,
      revenue_bs: parseFloat(p.total_revenue_bs) || 0,
      revenue_usd: parseFloat(p.total_revenue_usd) || 0,
    }));

    return {
      sales_trend: salesTrend,
      top_products_trend: topProductsTrend,
    };
  }
}
