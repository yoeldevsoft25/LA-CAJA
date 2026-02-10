import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { Product } from '../database/entities/product.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { Customer } from '../database/entities/customer.entity';
import { DebtStatus } from '../database/entities/debt.entity';
import { Shift } from '../database/entities/shift.entity';
import { ShiftCut } from '../database/entities/shift-cut.entity';
import { Profile } from '../database/entities/profile.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { ProductSerial } from '../database/entities/product-serial.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../database/entities/purchase-order-item.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { FiscalInvoiceItem } from '../database/entities/fiscal-invoice-item.entity';
import { RedisCacheService } from '../common/cache/redis-cache.service';

@Injectable()
export class ReportsService {
  /**
   * Normaliza una fecha al inicio del día en hora local
   * Evita problemas de zona horaria al comparar con TIMESTAMPTZ
   */
  private normalizeStartDate(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  /**
   * Normaliza una fecha al final del día en hora local
   * Evita problemas de zona horaria al comparar con TIMESTAMPTZ
   */
  private normalizeEndDate(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return new Date(year, month, day, 23, 59, 59, 999);
  }

  private normalizeWeightToKg(
    value: number,
    unit: 'kg' | 'g' | 'lb' | 'oz' | null | undefined,
  ): number {
    const safeValue = Number(value || 0);
    switch (unit) {
      case 'g':
        return safeValue / 1000;
      case 'lb':
        return safeValue * 0.45359237;
      case 'oz':
        return safeValue * 0.028349523125;
      case 'kg':
      default:
        return safeValue;
    }
  }

  private formatNumber(value: number, decimals: number): string {
    const safeValue = Number.isFinite(value) ? value : 0;
    const fixed = safeValue.toFixed(decimals);
    return fixed.replace(/\.?0+$/, '');
  }

  private formatQuantityForReport(
    value: number,
    isWeight: boolean,
    unit: 'kg' | 'g' | 'lb' | 'oz' | null | undefined,
  ): string {
    if (isWeight) {
      const kgValue = this.normalizeWeightToKg(value, unit);
      return `${this.formatNumber(kgValue, 3)} kg`;
    }
    return `${this.formatNumber(value, 0)} unid`;
  }

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
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(ShiftCut)
    private shiftCutRepository: Repository<ShiftCut>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(ProductLot)
    private productLotRepository: Repository<ProductLot>,
    @InjectRepository(ProductSerial)
    private productSerialRepository: Repository<ProductSerial>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(FiscalInvoice)
    private fiscalInvoiceRepository: Repository<FiscalInvoice>,
    @InjectRepository(FiscalInvoiceItem)
    private fiscalInvoiceItemRepository: Repository<FiscalInvoiceItem>,
    private cache: RedisCacheService,
  ) {}

  async getSalesByDay(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_sales: number;
    total_amount_bs: number;
    total_amount_usd: number;
    total_cost_bs: number;
    total_cost_usd: number;
    total_profit_bs: number;
    total_profit_usd: number;
    profit_margin: number;
    by_payment_method: Record<
      string,
      { count: number; amount_bs: number; amount_usd: number }
    >;
    daily: Array<{
      date: string;
      sales_count: number;
      total_bs: number;
      total_usd: number;
      cost_bs: number;
      cost_usd: number;
      profit_bs: number;
      profit_usd: number;
    }>;
  }> {
    const cacheKey = `reports:sales_by_day:${storeId}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const start = startDate
      ? this.normalizeStartDate(new Date(startDate))
      : undefined;
    const end = endDate ? this.normalizeEndDate(new Date(endDate)) : undefined;

    const totalsBsExpr =
      "COALESCE((sale.totals->>'total_bs')::numeric, 0)";
    const totalsUsdExpr =
      "COALESCE((sale.totals->>'total_usd')::numeric, 0)";
    const methodExpr = "COALESCE(sale.payment->>'method', 'unknown')";
    // Mantener compatibilidad con el comportamiento anterior (ISO string => día UTC)
    const dayExpr =
      "to_char((sale.sold_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')";

    const dailySalesRows = await this.saleRepository
      .createQueryBuilder('sale')
      .select(dayExpr, 'date')
      .addSelect('COUNT(sale.id)', 'sales_count')
      .addSelect(`COALESCE(SUM(${totalsBsExpr}), 0)`, 'total_bs')
      .addSelect(`COALESCE(SUM(${totalsUsdExpr}), 0)`, 'total_usd')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere(start ? 'sale.sold_at >= :start' : '1=1', { start })
      .andWhere(end ? 'sale.sold_at <= :end' : '1=1', { end })
      .groupBy(dayExpr)
      .orderBy(dayExpr, 'ASC')
      .getRawMany();

    const isWeightExpr =
      '(item.is_weight_product = true OR product.is_weight_product = true)';
    // In grouped queries, never select item.* booleans directly (would require GROUP BY).
    // For "is_weight_product" we use an aggregate over items + product flag.
    const isWeightGroupExpr =
      '(product.is_weight_product = true OR COALESCE(BOOL_OR(item.is_weight_product), false) = true)';
    const unitCostBsExpr = `CASE
      WHEN ${isWeightExpr} THEN COALESCE(product.cost_per_weight_bs, product.cost_bs, 0)
      ELSE COALESCE(product.cost_bs, 0)
    END`;
    const unitCostUsdExpr = `CASE
      WHEN ${isWeightExpr} THEN COALESCE(product.cost_per_weight_usd, product.cost_usd, 0)
      ELSE COALESCE(product.cost_usd, 0)
    END`;

    const dailyCostRows = await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.sale_id')
      .innerJoin(Product, 'product', 'product.id = item.product_id')
      .select(dayExpr, 'date')
      .addSelect(`COALESCE(SUM((${unitCostBsExpr}) * item.qty), 0)`, 'cost_bs')
      .addSelect(`COALESCE(SUM((${unitCostUsdExpr}) * item.qty), 0)`, 'cost_usd')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere(start ? 'sale.sold_at >= :start' : '1=1', { start })
      .andWhere(end ? 'sale.sold_at <= :end' : '1=1', { end })
      .groupBy(dayExpr)
      .orderBy(dayExpr, 'ASC')
      .getRawMany();

    const totalsAgg = await this.saleRepository
      .createQueryBuilder('sale')
      .select('COUNT(sale.id)', 'total_sales')
      .addSelect(`COALESCE(SUM(${totalsBsExpr}), 0)`, 'total_amount_bs')
      .addSelect(`COALESCE(SUM(${totalsUsdExpr}), 0)`, 'total_amount_usd')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere(start ? 'sale.sold_at >= :start' : '1=1', { start })
      .andWhere(end ? 'sale.sold_at <= :end' : '1=1', { end })
      .getRawOne();

    const totalCostAgg = await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.sale_id')
      .innerJoin(Product, 'product', 'product.id = item.product_id')
      .select(
        `COALESCE(SUM((${unitCostBsExpr}) * item.qty), 0)`,
        'total_cost_bs',
      )
      .addSelect(
        `COALESCE(SUM((${unitCostUsdExpr}) * item.qty), 0)`,
        'total_cost_usd',
      )
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere(start ? 'sale.sold_at >= :start' : '1=1', { start })
      .andWhere(end ? 'sale.sold_at <= :end' : '1=1', { end })
      .getRawOne();

    const byPaymentRows = await this.saleRepository
      .createQueryBuilder('sale')
      .select(methodExpr, 'method')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect(`COALESCE(SUM(${totalsBsExpr}), 0)`, 'amount_bs')
      .addSelect(`COALESCE(SUM(${totalsUsdExpr}), 0)`, 'amount_usd')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere(start ? 'sale.sold_at >= :start' : '1=1', { start })
      .andWhere(end ? 'sale.sold_at <= :end' : '1=1', { end })
      .groupBy(methodExpr)
      .orderBy('count', 'DESC')
      .getRawMany();

    const by_payment_method: Record<
      string,
      { count: number; amount_bs: number; amount_usd: number }
    > = {};
    for (const row of byPaymentRows) {
      const method = row.method || 'unknown';
      by_payment_method[method] = {
        count: Number(row.count || 0),
        amount_bs: Number(row.amount_bs || 0),
        amount_usd: Number(row.amount_usd || 0),
      };
    }

    const costByDate = new Map<
      string,
      { cost_bs: number; cost_usd: number }
    >();
    for (const row of dailyCostRows) {
      costByDate.set(row.date, {
        cost_bs: Number(row.cost_bs || 0),
        cost_usd: Number(row.cost_usd || 0),
      });
    }

    const daily = dailySalesRows.map((row) => {
      const cost = costByDate.get(row.date) || { cost_bs: 0, cost_usd: 0 };
      const total_bs = Number(row.total_bs || 0);
      const total_usd = Number(row.total_usd || 0);
      return {
        date: row.date,
        sales_count: Number(row.sales_count || 0),
        total_bs,
        total_usd,
        cost_bs: cost.cost_bs,
        cost_usd: cost.cost_usd,
        profit_bs: total_bs - cost.cost_bs,
        profit_usd: total_usd - cost.cost_usd,
      };
    });

    const total_sales = Number(totalsAgg?.total_sales || 0);
    const total_amount_bs = Number(totalsAgg?.total_amount_bs || 0);
    const total_amount_usd = Number(totalsAgg?.total_amount_usd || 0);
    const total_cost_bs = Number(totalCostAgg?.total_cost_bs || 0);
    const total_cost_usd = Number(totalCostAgg?.total_cost_usd || 0);

    const total_profit_bs = total_amount_bs - total_cost_bs;
    const total_profit_usd = total_amount_usd - total_cost_usd;
    const profit_margin =
      total_amount_usd > 0 ? (total_profit_usd / total_amount_usd) * 100 : 0;

    const result = {
      total_sales,
      total_amount_bs,
      total_amount_usd,
      total_cost_bs,
      total_cost_usd,
      total_profit_bs,
      total_profit_usd,
      profit_margin,
      by_payment_method,
      daily,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getTopProducts(
    storeId: string,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    Array<{
      product_id: string;
      product_name: string;
      quantity_sold: number;
      quantity_sold_kg: number;
      quantity_sold_units: number;
      revenue_bs: number;
      revenue_usd: number;
      cost_bs: number;
      cost_usd: number;
      profit_bs: number;
      profit_usd: number;
      profit_margin: number;
      is_weight_product: boolean;
      weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;
    }>
  > {
    const cacheKey = `reports:top_products:${storeId}:${limit}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const start = startDate
      ? this.normalizeStartDate(new Date(startDate))
      : undefined;
    const end = endDate ? this.normalizeEndDate(new Date(endDate)) : undefined;

    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));

    const isWeightExpr =
      '(item.is_weight_product = true OR product.is_weight_product = true)';
    // In grouped queries, never select item.* booleans directly (would require GROUP BY).
    // For "is_weight_product" we use an aggregate over items + product flag.
    const isWeightGroupExpr =
      '(product.is_weight_product = true OR COALESCE(BOOL_OR(item.is_weight_product), false) = true)';
    const unitExpr = 'COALESCE(item.weight_unit, product.weight_unit)';
    const kgFactorExpr = `CASE ${unitExpr}
      WHEN 'g' THEN 0.001
      WHEN 'lb' THEN 0.45359237
      WHEN 'oz' THEN 0.028349523125
      ELSE 1
    END`;

    const unitCostBsExpr = `CASE
      WHEN ${isWeightExpr} THEN COALESCE(product.cost_per_weight_bs, product.cost_bs, 0)
      ELSE COALESCE(product.cost_bs, 0)
    END`;
    const unitCostUsdExpr = `CASE
      WHEN ${isWeightExpr} THEN COALESCE(product.cost_per_weight_usd, product.cost_usd, 0)
      ELSE COALESCE(product.cost_usd, 0)
    END`;

    const rows = await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.sale_id')
      .innerJoin(Product, 'product', 'product.id = item.product_id')
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect(isWeightGroupExpr, 'is_weight_product')
      .addSelect('product.weight_unit', 'weight_unit')
      .addSelect('COALESCE(SUM(item.qty), 0)', 'quantity_sold')
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${isWeightExpr} THEN (item.qty * ${kgFactorExpr}) ELSE 0 END), 0)`,
        'quantity_sold_kg',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN NOT ${isWeightExpr} THEN item.qty ELSE 0 END), 0)`,
        'quantity_sold_units',
      )
      .addSelect(
        "COALESCE(SUM((item.unit_price_bs * item.qty) - COALESCE(item.discount_bs, 0)), 0)",
        'revenue_bs',
      )
      .addSelect(
        "COALESCE(SUM((item.unit_price_usd * item.qty) - COALESCE(item.discount_usd, 0)), 0)",
        'revenue_usd',
      )
      .addSelect(
        `COALESCE(SUM((${unitCostBsExpr}) * item.qty), 0)`,
        'cost_bs',
      )
      .addSelect(
        `COALESCE(SUM((${unitCostUsdExpr}) * item.qty), 0)`,
        'cost_usd',
      )
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere(start ? 'sale.sold_at >= :start' : '1=1', { start })
      .andWhere(end ? 'sale.sold_at <= :end' : '1=1', { end })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.is_weight_product')
      .addGroupBy('product.weight_unit')
      .orderBy(
        `CASE WHEN ${isWeightGroupExpr}
          THEN SUM(CASE WHEN ${isWeightExpr} THEN (item.qty * ${kgFactorExpr}) ELSE 0 END)
          ELSE SUM(CASE WHEN NOT ${isWeightExpr} THEN item.qty ELSE 0 END)
        END`,
        'DESC',
      )
      .limit(safeLimit)
      .getRawMany();

    const result = rows.map((r) => {
      const revenue_bs = Number(r.revenue_bs || 0);
      const revenue_usd = Number(r.revenue_usd || 0);
      const cost_bs = Number(r.cost_bs || 0);
      const cost_usd = Number(r.cost_usd || 0);
      const profit_bs = revenue_bs - cost_bs;
      const profit_usd = revenue_usd - cost_usd;
      const profit_margin =
        revenue_usd > 0 ? (profit_usd / revenue_usd) * 100 : 0;

      return {
        product_id: r.product_id,
        product_name: r.product_name,
        quantity_sold: Number(r.quantity_sold || 0),
        quantity_sold_kg: Number(r.quantity_sold_kg || 0),
        quantity_sold_units: Number(r.quantity_sold_units || 0),
        revenue_bs,
        revenue_usd,
        cost_bs,
        cost_usd,
        profit_bs,
        profit_usd,
        profit_margin,
        is_weight_product:
          r.is_weight_product === true ||
          r.is_weight_product === 't' ||
          r.is_weight_product === 1,
        weight_unit: r.weight_unit ?? null,
      };
    });
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getDebtSummary(storeId: string): Promise<{
    total_debt_bs: number;
    total_debt_usd: number;
    total_paid_bs: number;
    total_paid_usd: number;
    total_pending_bs: number;
    total_pending_usd: number;
    by_status: {
      open: number;
      partial: number;
      paid: number;
    };
    top_debtors: Array<{
      customer_id: string;
      customer_name: string;
      total_debt_bs: number;
      total_debt_usd: number;
      total_paid_bs: number;
      total_paid_usd: number;
      pending_bs: number;
      pending_usd: number;
    }>;
  }> {
    const cacheKey = `reports:debt_summary:${storeId}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const totalsAgg = await this.debtRepository
      .createQueryBuilder('debt')
      .select('COALESCE(SUM(debt.amount_bs), 0)', 'total_debt_bs')
      .addSelect('COALESCE(SUM(debt.amount_usd), 0)', 'total_debt_usd')
      .where('debt.store_id = :storeId', { storeId })
      .getRawOne();

    const paidAgg = await this.debtPaymentRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount_bs), 0)', 'total_paid_bs')
      .addSelect('COALESCE(SUM(payment.amount_usd), 0)', 'total_paid_usd')
      .where('payment.store_id = :storeId', { storeId })
      .getRawOne();

    const byStatusRows = await this.debtRepository
      .createQueryBuilder('debt')
      .select('debt.status', 'status')
      .addSelect('COUNT(debt.id)', 'count')
      .where('debt.store_id = :storeId', { storeId })
      .groupBy('debt.status')
      .getRawMany();

    const by_status = { open: 0, partial: 0, paid: 0 };
    for (const row of byStatusRows) {
      if (row.status === DebtStatus.OPEN) by_status.open = Number(row.count || 0);
      if (row.status === DebtStatus.PARTIAL) by_status.partial = Number(row.count || 0);
      if (row.status === DebtStatus.PAID) by_status.paid = Number(row.count || 0);
    }

    const debtByCustomerRows = await this.debtRepository
      .createQueryBuilder('debt')
      .select('debt.customer_id', 'customer_id')
      .addSelect('COALESCE(SUM(debt.amount_bs), 0)', 'total_debt_bs')
      .addSelect('COALESCE(SUM(debt.amount_usd), 0)', 'total_debt_usd')
      .where('debt.store_id = :storeId', { storeId })
      .groupBy('debt.customer_id')
      .getRawMany();

    const paidByCustomerRows = await this.debtPaymentRepository
      .createQueryBuilder('payment')
      .innerJoin(Debt, 'debt', 'debt.id = payment.debt_id')
      .select('debt.customer_id', 'customer_id')
      .addSelect('COALESCE(SUM(payment.amount_bs), 0)', 'total_paid_bs')
      .addSelect('COALESCE(SUM(payment.amount_usd), 0)', 'total_paid_usd')
      .where('debt.store_id = :storeId', { storeId })
      .groupBy('debt.customer_id')
      .getRawMany();

    const paidByCustomer = new Map<
      string,
      { total_paid_bs: number; total_paid_usd: number }
    >();
    for (const row of paidByCustomerRows) {
      paidByCustomer.set(row.customer_id, {
        total_paid_bs: Number(row.total_paid_bs || 0),
        total_paid_usd: Number(row.total_paid_usd || 0),
      });
    }

    const customerIds = debtByCustomerRows
      .map((r) => r.customer_id)
      .filter(Boolean);
    const customers =
      customerIds.length > 0
        ? await this.customerRepository.find({
            where: { id: In(customerIds), store_id: storeId },
            select: ['id', 'name'],
          })
        : [];
    const customerNameById = new Map(customers.map((c) => [c.id, c.name]));

    const top_debtors = debtByCustomerRows
      .map((row) => {
        const customer_id = row.customer_id;
        const debt_bs = Number(row.total_debt_bs || 0);
        const debt_usd = Number(row.total_debt_usd || 0);
        const paid = paidByCustomer.get(customer_id) || {
          total_paid_bs: 0,
          total_paid_usd: 0,
        };
        return {
          customer_id,
          customer_name:
            customerNameById.get(customer_id) ||
            `Cliente ${String(customer_id).substring(0, 8)}`,
          total_debt_bs: debt_bs,
          total_debt_usd: debt_usd,
          total_paid_bs: paid.total_paid_bs,
          total_paid_usd: paid.total_paid_usd,
          pending_bs: debt_bs - paid.total_paid_bs,
          pending_usd: debt_usd - paid.total_paid_usd,
        };
      })
      .filter((d) => d.pending_bs > 0 || d.pending_usd > 0)
      .sort((a, b) => b.pending_bs - a.pending_bs)
      .slice(0, 10);

    const total_debt_bs = Number(totalsAgg?.total_debt_bs || 0);
    const total_debt_usd = Number(totalsAgg?.total_debt_usd || 0);
    const total_paid_bs = Number(paidAgg?.total_paid_bs || 0);
    const total_paid_usd = Number(paidAgg?.total_paid_usd || 0);

    const result = {
      total_debt_bs,
      total_debt_usd,
      total_paid_bs,
      total_paid_usd,
      total_pending_bs: total_debt_bs - total_paid_bs,
      total_pending_usd: total_debt_usd - total_paid_usd,
      by_status,
      top_debtors,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async exportSalesCSV(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<string> {
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL');

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('sale.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('sale.sold_at <= :endDate', { endDate: end });
    }

    query.orderBy('sale.sold_at', 'DESC');

    const sales = await query.getMany();

    // Generar CSV
    const headers = [
      'Fecha',
      'ID Venta',
      'Total BS',
      'Total USD',
      'Método de Pago',
      'Items',
    ];
    const rows: string[] = [headers.join(',')];

    // Obtener items para todas las ventas en un solo query (evita N+1)
    const saleIds = sales.map((s) => s.id);
    const allItems =
      saleIds.length > 0
        ? await this.saleItemRepository.find({
            where: { sale_id: In(saleIds) },
          })
        : [];
    const itemsBySaleId = new Map<string, SaleItem[]>();
    for (const item of allItems) {
      if (!itemsBySaleId.has(item.sale_id)) itemsBySaleId.set(item.sale_id, []);
      itemsBySaleId.get(item.sale_id)!.push(item);
    }

    // Obtener items para cada venta
    for (const sale of sales) {
      const items = itemsBySaleId.get(sale.id) || [];

      const totals = sale.totals || {};
      const payment = sale.payment || {};
      const date = sale.sold_at.toISOString().split('T')[0];
      const method = payment.method || 'unknown';

      const itemsStr = items
        .map((item) => {
          const qtyLabel = this.formatQuantityForReport(
            Number(item.qty) || 0,
            Boolean(item.is_weight_product),
            item.weight_unit,
          );
          return `${qtyLabel} x ${item.product_id}`;
        })
        .join('; ');

      rows.push(
        [
          date,
          sale.id,
          totals.total_bs || 0,
          totals.total_usd || 0,
          method,
          `"${itemsStr}"`,
        ].join(','),
      );
    }

    return rows.join('\n');
  }

  /**
   * Reporte por turno/cajero
   */
  async getShiftsReport(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
    cashierId?: string,
  ): Promise<{
    total_shifts: number;
    total_sales_bs: number;
    total_sales_usd: number;
    total_differences_bs: number;
    total_differences_usd: number;
    by_cashier: Array<{
      cashier_id: string;
      cashier_name: string;
      shifts_count: number;
      total_sales_bs: number;
      total_sales_usd: number;
      total_differences_bs: number;
      total_differences_usd: number;
    }>;
    shifts: Array<{
      shift_id: string;
      cashier_id: string;
      cashier_name: string;
      opened_at: Date;
      closed_at: Date | null;
      sales_count: number;
      total_sales_bs: number;
      total_sales_usd: number;
      difference_bs: number | null;
      difference_usd: number | null;
    }>;
  }> {
    const cacheKey = `reports:shifts:${storeId}:${cashierId || 'all'}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const query = this.shiftRepository
      .createQueryBuilder('shift')
      .where('shift.store_id = :storeId', { storeId });

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('shift.opened_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('shift.opened_at <= :endDate', { endDate: end });
    }
    if (cashierId) {
      query.andWhere('shift.cashier_id = :cashierId', { cashierId });
    }

    const now = new Date();
    const totalsBsExpr =
      "COALESCE((sale.totals->>'total_bs')::numeric, 0)";
    const totalsUsdExpr =
      "COALESCE((sale.totals->>'total_usd')::numeric, 0)";

    // Evita N+1: agregamos ventas por turno en SQL.
    // Nota: el join incluye rango temporal por shift; esto es mas eficiente que hacer 1 query por shift.
    const shiftsWithSales = await query
      .leftJoinAndSelect('shift.cashier', 'cashier')
      .leftJoin(
        Sale,
        'sale',
        [
          'sale.store_id = shift.store_id',
          'sale.sold_by_user_id = shift.cashier_id',
          'sale.voided_at IS NULL',
          'sale.sold_at >= shift.opened_at',
          'sale.sold_at <= COALESCE(shift.closed_at, :now)',
        ].join(' AND '),
        { now },
      )
      .select([
        'shift.id',
        'shift.cashier_id',
        'shift.opened_at',
        'shift.closed_at',
        'shift.difference_bs',
        'shift.difference_usd',
        'cashier.id',
        'cashier.full_name',
      ])
      .addSelect('COUNT(sale.id)', 'sales_count')
      .addSelect(`COALESCE(SUM(${totalsBsExpr}), 0)`, 'total_sales_bs')
      .addSelect(`COALESCE(SUM(${totalsUsdExpr}), 0)`, 'total_sales_usd')
      .groupBy('shift.id')
      .addGroupBy('cashier.id')
      .orderBy('shift.opened_at', 'DESC')
      .getRawAndEntities();

    const cashierMap = new Map<
      string,
      {
        cashier_name: string;
        shifts_count: number;
        total_sales_bs: number;
        total_sales_usd: number;
        total_differences_bs: number;
        total_differences_usd: number;
      }
    >();

    let total_sales_bs = 0;
    let total_sales_usd = 0;
    let total_differences_bs = 0;
    let total_differences_usd = 0;

    const shiftsData: Array<{
      shift_id: string;
      cashier_id: string;
      cashier_name: string;
      opened_at: Date;
      closed_at: Date | null;
      sales_count: number;
      total_sales_bs: number;
      total_sales_usd: number;
      difference_bs: number | null;
      difference_usd: number | null;
    }> = [];

    const { entities: shifts, raw } = shiftsWithSales;

    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const row = raw[i] as any;
      const shiftSalesBs = Number(row?.total_sales_bs || 0);
      const shiftSalesUsd = Number(row?.total_sales_usd || 0);
      const salesCount = Number(row?.sales_count || 0);

      total_sales_bs += shiftSalesBs;
      total_sales_usd += shiftSalesUsd;

      const diffBs = shift.difference_bs ? Number(shift.difference_bs) : 0;
      const diffUsd = shift.difference_usd ? Number(shift.difference_usd) : 0;
      total_differences_bs += diffBs;
      total_differences_usd += diffUsd;

      const cashierName =
        shift.cashier?.full_name ||
        `Cajero ${shift.cashier_id.substring(0, 8)}`;

      if (!cashierMap.has(shift.cashier_id)) {
        cashierMap.set(shift.cashier_id, {
          cashier_name: cashierName,
          shifts_count: 0,
          total_sales_bs: 0,
          total_sales_usd: 0,
          total_differences_bs: 0,
          total_differences_usd: 0,
        });
      }

      const cashierData = cashierMap.get(shift.cashier_id)!;
      cashierData.shifts_count++;
      cashierData.total_sales_bs += shiftSalesBs;
      cashierData.total_sales_usd += shiftSalesUsd;
      cashierData.total_differences_bs += diffBs;
      cashierData.total_differences_usd += diffUsd;

      shiftsData.push({
        shift_id: shift.id,
        cashier_id: shift.cashier_id,
        cashier_name: cashierName,
        opened_at: shift.opened_at,
        closed_at: shift.closed_at,
        sales_count: salesCount,
        total_sales_bs: shiftSalesBs,
        total_sales_usd: shiftSalesUsd,
        difference_bs: shift.difference_bs,
        difference_usd: shift.difference_usd,
      });
    }

    const result = {
      total_shifts: shifts.length,
      total_sales_bs,
      total_sales_usd,
      total_differences_bs,
      total_differences_usd,
      by_cashier: Array.from(cashierMap.entries()).map(
        ([cashier_id, data]) => ({
          cashier_id,
          ...data,
        }),
      ),
      shifts: shiftsData,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  /**
   * Reporte de arqueos y diferencias
   */
  async getArqueosReport(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_arqueos: number;
    total_differences_bs: number;
    total_differences_usd: number;
    shifts_with_differences: number;
    shifts_without_differences: number;
    by_cashier: Array<{
      cashier_id: string;
      cashier_name: string;
      arqueos_count: number;
      total_differences_bs: number;
      total_differences_usd: number;
    }>;
    arqueos: Array<{
      shift_id: string;
      cashier_id: string;
      cashier_name: string;
      closed_at: Date;
      expected_bs: number;
      expected_usd: number;
      counted_bs: number;
      counted_usd: number;
      difference_bs: number;
      difference_usd: number;
    }>;
  }> {
    const cacheKey = `reports:arqueos:${storeId}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const query = this.shiftRepository
      .createQueryBuilder('shift')
      .where('shift.store_id = :storeId', { storeId })
      .andWhere('shift.status = :status', { status: 'closed' })
      .andWhere('shift.closed_at IS NOT NULL');

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('shift.closed_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('shift.closed_at <= :endDate', { endDate: end });
    }

    // Minimiza payload: extrae solo los campos necesarios (incluyendo valores cash_* desde JSONB)
    const shifts = await query
      .leftJoin('shift.cashier', 'cashier')
      .select('shift.id', 'shift_id')
      .addSelect('shift.cashier_id', 'cashier_id')
      .addSelect('cashier.full_name', 'cashier_name')
      .addSelect('shift.closed_at', 'closed_at')
      .addSelect('shift.difference_bs', 'difference_bs')
      .addSelect('shift.difference_usd', 'difference_usd')
      .addSelect(
        "COALESCE((shift.expected_totals->>'cash_bs')::numeric, 0)",
        'expected_cash_bs',
      )
      .addSelect(
        "COALESCE((shift.expected_totals->>'cash_usd')::numeric, 0)",
        'expected_cash_usd',
      )
      .addSelect(
        "COALESCE((shift.counted_totals->>'cash_bs')::numeric, 0)",
        'counted_cash_bs',
      )
      .addSelect(
        "COALESCE((shift.counted_totals->>'cash_usd')::numeric, 0)",
        'counted_cash_usd',
      )
      .orderBy('shift.closed_at', 'DESC')
      .getRawMany();

    const cashierMap = new Map<
      string,
      {
        cashier_name: string;
        arqueos_count: number;
        total_differences_bs: number;
        total_differences_usd: number;
      }
    >();

    let total_differences_bs = 0;
    let total_differences_usd = 0;
    let shifts_with_differences = 0;
    let shifts_without_differences = 0;

    const arqueosData: Array<{
      shift_id: string;
      cashier_id: string;
      cashier_name: string;
      closed_at: Date;
      expected_bs: number;
      expected_usd: number;
      counted_bs: number;
      counted_usd: number;
      difference_bs: number;
      difference_usd: number;
    }> = [];

    for (const shift of shifts) {
      const diffBs = shift.difference_bs ? Number(shift.difference_bs) : 0;
      const diffUsd = shift.difference_usd ? Number(shift.difference_usd) : 0;

      total_differences_bs += Math.abs(diffBs);
      total_differences_usd += Math.abs(diffUsd);

      if (diffBs !== 0 || diffUsd !== 0) {
        shifts_with_differences++;
      } else {
        shifts_without_differences++;
      }

      const cashierName =
        shift.cashier_name || `Cajero ${shift.cashier_id.substring(0, 8)}`;

      if (!cashierMap.has(shift.cashier_id)) {
        cashierMap.set(shift.cashier_id, {
          cashier_name: cashierName,
          arqueos_count: 0,
          total_differences_bs: 0,
          total_differences_usd: 0,
        });
      }

      const cashierData = cashierMap.get(shift.cashier_id)!;
      cashierData.arqueos_count++;
      cashierData.total_differences_bs += Math.abs(diffBs);
      cashierData.total_differences_usd += Math.abs(diffUsd);

      arqueosData.push({
        shift_id: shift.shift_id,
        cashier_id: shift.cashier_id,
        cashier_name: cashierName,
        closed_at: shift.closed_at,
        expected_bs: Number(shift.expected_cash_bs || 0),
        expected_usd: Number(shift.expected_cash_usd || 0),
        counted_bs: Number(shift.counted_cash_bs || 0),
        counted_usd: Number(shift.counted_cash_usd || 0),
        difference_bs: diffBs,
        difference_usd: diffUsd,
      });
    }

    const result = {
      total_arqueos: shifts.length,
      total_differences_bs,
      total_differences_usd,
      shifts_with_differences,
      shifts_without_differences,
      by_cashier: Array.from(cashierMap.entries()).map(
        ([cashier_id, data]) => ({
          cashier_id,
          ...data,
        }),
      ),
      arqueos: arqueosData,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  /**
   * Reporte de productos próximos a vencer
   */
  async getExpiringProductsReport(
    storeId: string,
    daysAhead: number = 30,
  ): Promise<{
    total_lots: number;
    total_quantity: number;
    total_value_bs: number;
    total_value_usd: number;
    by_product: Array<{
      product_id: string;
      product_name: string;
      lots_count: number;
      total_quantity: number;
      expiration_dates: Array<{
        lot_number: string;
        expiration_date: Date;
        quantity: number;
        days_until_expiration: number;
      }>;
    }>;
  }> {
    const cacheKey = `reports:expiring_products:${storeId}:${daysAhead}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const expirationLimit = new Date(now);
    expirationLimit.setDate(expirationLimit.getDate() + daysAhead);

    // Evita N+1: incluye producto en el mismo query.
    const lots = await this.productLotRepository
      .createQueryBuilder('lot')
      .innerJoinAndSelect('lot.product', 'product')
      .where('product.store_id = :storeId', { storeId })
      .andWhere('lot.expiration_date IS NOT NULL')
      .andWhere('lot.expiration_date <= :expirationLimit', { expirationLimit })
      .andWhere('lot.expiration_date >= :now', {
        now: now.toISOString().split('T')[0],
      })
      .andWhere('lot.remaining_quantity > 0')
      .orderBy('lot.expiration_date', 'ASC')
      .getMany();

    const productMap = new Map<
      string,
      {
        product_name: string;
        lots_count: number;
        total_quantity: number;
        expiration_dates: Array<{
          lot_number: string;
          expiration_date: Date;
          quantity: number;
          days_until_expiration: number;
        }>;
      }
    >();

    let total_quantity = 0;
    let total_value_bs = 0;
    let total_value_usd = 0;

    for (const lot of lots) {
      const productName =
        lot.product?.name ?? `Producto ${lot.product_id.substring(0, 8)}`;

      const daysUntilExpiration = Math.ceil(
        (lot.expiration_date!.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (!productMap.has(lot.product_id)) {
        productMap.set(lot.product_id, {
          product_name: productName,
          lots_count: 0,
          total_quantity: 0,
          expiration_dates: [],
        });
      }

      const productData = productMap.get(lot.product_id)!;
      productData.lots_count++;
      productData.total_quantity += Number(lot.remaining_quantity);
      productData.expiration_dates.push({
        lot_number: lot.lot_number,
        expiration_date: lot.expiration_date!,
        quantity: Number(lot.remaining_quantity),
        days_until_expiration: daysUntilExpiration,
      });

      total_quantity += Number(lot.remaining_quantity);
      total_value_bs +=
        Number(lot.unit_cost_bs || 0) * Number(lot.remaining_quantity);
      total_value_usd +=
        Number(lot.unit_cost_usd || 0) * Number(lot.remaining_quantity);
    }

    const result = {
      total_lots: lots.length,
      total_quantity,
      total_value_bs,
      total_value_usd,
      by_product: Array.from(productMap.entries()).map(
        ([product_id, data]) => ({
          product_id,
          ...data,
        }),
      ),
    };
    await this.cache.set(cacheKey, result, 120);
    return result;
  }

  /**
   * Reporte de seriales vendidos
   */
  async getSerialsReport(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_serials: number;
    sold_serials: number;
    available_serials: number;
    by_product: Array<{
      product_id: string;
      product_name: string;
      total_serials: number;
      sold_serials: number;
      available_serials: number;
    }>;
    serials: Array<{
      serial_id: string;
      product_id: string;
      product_name: string;
      serial_number: string;
      status: string;
      sold_at: Date | null;
      sale_id: string | null;
    }>;
  }> {
    const cacheKey = `reports:serials:${storeId}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const query = this.productSerialRepository
      .createQueryBuilder('serial')
      .innerJoinAndSelect('serial.product', 'product')
      .where('product.store_id = :storeId', { storeId });

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('serial.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('serial.sold_at <= :endDate', { endDate: end });
    }

    const serials = await query.orderBy('serial.sold_at', 'DESC').getMany();

    const productMap = new Map<
      string,
      {
        product_name: string;
        total_serials: number;
        sold_serials: number;
        available_serials: number;
      }
    >();

    let sold_serials = 0;
    let available_serials = 0;

    const serialsData: Array<{
      serial_id: string;
      product_id: string;
      product_name: string;
      serial_number: string;
      status: string;
      sold_at: Date | null;
      sale_id: string | null;
    }> = [];

    for (const serial of serials) {
      const productName =
        serial.product?.name ?? `Producto ${serial.product_id.substring(0, 8)}`;

      if (!productMap.has(serial.product_id)) {
        productMap.set(serial.product_id, {
          product_name: productName,
          total_serials: 0,
          sold_serials: 0,
          available_serials: 0,
        });
      }

      const productData = productMap.get(serial.product_id)!;
      productData.total_serials++;

      if (serial.status === 'sold') {
        productData.sold_serials++;
        sold_serials++;
      } else if (serial.status === 'available') {
        productData.available_serials++;
        available_serials++;
      }

      serialsData.push({
        serial_id: serial.id,
        product_id: serial.product_id,
        product_name: productName,
        serial_number: serial.serial_number,
        status: serial.status,
        sold_at: serial.sold_at,
        sale_id: serial.sale_id,
      });
    }

    const result = {
      total_serials: serials.length,
      sold_serials,
      available_serials,
      by_product: Array.from(productMap.entries()).map(
        ([product_id, data]) => ({
          product_id,
          ...data,
        }),
      ),
      serials: serialsData,
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  /**
   * Reporte de rotación de productos
   */
  async getRotationReport(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    by_product: Array<{
      product_id: string;
      product_name: string;
      quantity_sold: number;
      quantity_sold_kg: number;
      quantity_sold_units: number;
      revenue_bs: number;
      revenue_usd: number;
      cost_bs: number;
      cost_usd: number;
      profit_bs: number;
      profit_usd: number;
      profit_margin: number;
      rotation_rate: number; // Ventas / Stock promedio
      rotation_unit: 'kg' | 'unid';
      is_weight_product: boolean;
      weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;
    }>;
  }> {
    const cacheKey = `reports:rotation:${storeId}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const start = startDate
      ? this.normalizeStartDate(new Date(startDate))
      : undefined;
    const end = endDate ? this.normalizeEndDate(new Date(endDate)) : undefined;

    // Agregación en DB: evita traer todos los items para agrupar en memoria.
    const isWeightExpr =
      '(item.is_weight_product = true OR product.is_weight_product = true)';
    const isWeightGroupExpr =
      '(product.is_weight_product = true OR COALESCE(BOOL_OR(item.is_weight_product), false) = true)';
    const unitExpr = 'COALESCE(item.weight_unit, product.weight_unit)';
    const kgFactorExpr = `CASE ${unitExpr}
      WHEN 'g' THEN 0.001
      WHEN 'lb' THEN 0.45359237
      WHEN 'oz' THEN 0.028349523125
      ELSE 1
    END`;

    const unitCostBsExpr = `CASE
      WHEN ${isWeightExpr} THEN COALESCE(product.cost_per_weight_bs, product.cost_bs, 0)
      ELSE COALESCE(product.cost_bs, 0)
    END`;
    const unitCostUsdExpr = `CASE
      WHEN ${isWeightExpr} THEN COALESCE(product.cost_per_weight_usd, product.cost_usd, 0)
      ELSE COALESCE(product.cost_usd, 0)
    END`;

    const rows = await this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.sale_id')
      .innerJoin(Product, 'product', 'product.id = item.product_id')
      .select('product.id', 'product_id')
      .addSelect('product.name', 'product_name')
      .addSelect(isWeightGroupExpr, 'is_weight_product')
      .addSelect('product.weight_unit', 'weight_unit')
      .addSelect('COALESCE(SUM(item.qty), 0)', 'quantity_sold')
      .addSelect(
        `COALESCE(SUM(CASE WHEN ${isWeightExpr} THEN (item.qty * ${kgFactorExpr}) ELSE 0 END), 0)`,
        'quantity_sold_kg',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN NOT ${isWeightExpr} THEN item.qty ELSE 0 END), 0)`,
        'quantity_sold_units',
      )
      .addSelect(
        "COALESCE(SUM((item.unit_price_bs * item.qty) - COALESCE(item.discount_bs, 0)), 0)",
        'revenue_bs',
      )
      .addSelect(
        "COALESCE(SUM((item.unit_price_usd * item.qty) - COALESCE(item.discount_usd, 0)), 0)",
        'revenue_usd',
      )
      .addSelect(
        `COALESCE(SUM((${unitCostBsExpr}) * item.qty), 0)`,
        'cost_bs',
      )
      .addSelect(
        `COALESCE(SUM((${unitCostUsdExpr}) * item.qty), 0)`,
        'cost_usd',
      )
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.voided_at IS NULL')
      .andWhere(start ? 'sale.sold_at >= :start' : '1=1', { start })
      .andWhere(end ? 'sale.sold_at <= :end' : '1=1', { end })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.is_weight_product')
      .addGroupBy('product.weight_unit')
      .orderBy(
        `CASE WHEN ${isWeightGroupExpr}
          THEN SUM(CASE WHEN ${isWeightExpr} THEN (item.qty * ${kgFactorExpr}) ELSE 0 END)
          ELSE SUM(CASE WHEN NOT ${isWeightExpr} THEN item.qty ELSE 0 END)
        END`,
        'DESC',
      )
      .getRawMany();

    const result = {
      by_product: rows
        .map((r) => {
          const revenue_bs = Number(r.revenue_bs || 0);
          const revenue_usd = Number(r.revenue_usd || 0);
          const cost_bs = Number(r.cost_bs || 0);
          const cost_usd = Number(r.cost_usd || 0);
          const profit_bs = revenue_bs - cost_bs;
          const profit_usd = revenue_usd - cost_usd;
          const profit_margin =
            revenue_usd > 0 ? (profit_usd / revenue_usd) * 100 : 0;

          const isWeight =
            r.is_weight_product === true ||
            r.is_weight_product === 't' ||
            r.is_weight_product === 1;

          const quantity_sold_kg = Number(r.quantity_sold_kg || 0);
          const quantity_sold_units = Number(r.quantity_sold_units || 0);

          const rotation_base = isWeight ? quantity_sold_kg : quantity_sold_units;
          const rotation_unit: 'kg' | 'unid' = isWeight ? 'kg' : 'unid';
          // Rotación aproximada (ventas / 1, asumiendo stock promedio de 1)
          const rotation_rate = rotation_base;

          return {
            product_id: r.product_id,
            product_name: r.product_name,
            quantity_sold: Number(r.quantity_sold || 0),
            quantity_sold_kg,
            quantity_sold_units,
            revenue_bs,
            revenue_usd,
            cost_bs,
            cost_usd,
            profit_bs,
            profit_usd,
            profit_margin,
            rotation_rate,
            rotation_unit,
            is_weight_product: isWeight,
            weight_unit: r.weight_unit ?? null,
          };
        })
        .sort((a, b) => b.rotation_rate - a.rotation_rate),
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  /**
   * Reporte de compras por proveedor
   */
  async getPurchasesBySupplier(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total_orders: number;
    total_amount_bs: number;
    total_amount_usd: number;
    by_supplier: Array<{
      supplier_id: string;
      supplier_name: string;
      supplier_code: string | null;
      orders_count: number;
      total_amount_bs: number;
      total_amount_usd: number;
      completed_orders: number;
      pending_orders: number;
    }>;
  }> {
    const cacheKey = `reports:purchases_by_supplier:${storeId}:${startDate?.toISOString() || 'none'}:${endDate?.toISOString() || 'none'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const start = startDate
      ? this.normalizeStartDate(new Date(startDate))
      : undefined;
    const end = endDate ? this.normalizeEndDate(new Date(endDate)) : undefined;

    const statusPending = ['draft', 'sent', 'confirmed', 'partial'];

    const totalsAgg = await this.purchaseOrderRepository
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'total_orders')
      .addSelect('COALESCE(SUM(order.total_amount_bs), 0)', 'total_amount_bs')
      .addSelect('COALESCE(SUM(order.total_amount_usd), 0)', 'total_amount_usd')
      .where('order.store_id = :storeId', { storeId })
      .andWhere(start ? 'order.created_at >= :start' : '1=1', { start })
      .andWhere(end ? 'order.created_at <= :end' : '1=1', { end })
      .getRawOne();

    const rows = await this.purchaseOrderRepository
      .createQueryBuilder('order')
      .innerJoin('order.supplier', 'supplier')
      .select('supplier.id', 'supplier_id')
      .addSelect('supplier.name', 'supplier_name')
      .addSelect('supplier.code', 'supplier_code')
      .addSelect('COUNT(order.id)', 'orders_count')
      .addSelect('COALESCE(SUM(order.total_amount_bs), 0)', 'total_amount_bs')
      .addSelect('COALESCE(SUM(order.total_amount_usd), 0)', 'total_amount_usd')
      .addSelect(
        "COALESCE(SUM(CASE WHEN order.status = 'completed' THEN 1 ELSE 0 END), 0)",
        'completed_orders',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN order.status IN (:...pendingStatuses) THEN 1 ELSE 0 END), 0)`,
        'pending_orders',
      )
      .where('order.store_id = :storeId', { storeId })
      .andWhere(start ? 'order.created_at >= :start' : '1=1', { start })
      .andWhere(end ? 'order.created_at <= :end' : '1=1', { end })
      .setParameter('pendingStatuses', statusPending)
      .groupBy('supplier.id')
      .addGroupBy('supplier.name')
      .addGroupBy('supplier.code')
      .orderBy('total_amount_bs', 'DESC')
      .getRawMany();

    const result = {
      total_orders: Number(totalsAgg?.total_orders || 0),
      total_amount_bs: Number(totalsAgg?.total_amount_bs || 0),
      total_amount_usd: Number(totalsAgg?.total_amount_usd || 0),
      by_supplier: rows.map((r) => ({
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        supplier_code: r.supplier_code ?? null,
        orders_count: Number(r.orders_count || 0),
        total_amount_bs: Number(r.total_amount_bs || 0),
        total_amount_usd: Number(r.total_amount_usd || 0),
        completed_orders: Number(r.completed_orders || 0),
        pending_orders: Number(r.pending_orders || 0),
      })),
    };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  /**
   * Reporte de facturas fiscales emitidas
   */
  async getFiscalInvoicesReport(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
    status?: string,
  ): Promise<{
    total_invoices: number;
    total_amount_bs: number;
    total_amount_usd: number;
    total_tax_bs: number;
    total_tax_usd: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    daily: Array<{
      date: string;
      invoices_count: number;
      total_bs: number;
      total_usd: number;
      tax_bs: number;
      tax_usd: number;
    }>;
  }> {
    const query = this.fiscalInvoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.store_id = :storeId', { storeId });

    const start = startDate
      ? this.normalizeStartDate(new Date(startDate))
      : undefined;
    const end = endDate ? this.normalizeEndDate(new Date(endDate)) : undefined;

    if (start) {
      query.andWhere('invoice.issued_at >= :start', { start });
    }
    if (end) {
      query.andWhere('invoice.issued_at <= :end', { end });
    }
    // Mantener compatibilidad: aunque se pase status, este endpoint históricamente filtra emitidas.
    query.andWhere('invoice.status = :issuedStatus', { issuedStatus: 'issued' });
    if (status) {
      // No rompe prod: mantiene el filtro extra si alguien lo usa igual.
      query.andWhere('invoice.status = :status', { status });
    }

    const dayExpr =
      "to_char((invoice.issued_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')";

    const totalsAgg = await query
      .clone()
      .select('COUNT(invoice.id)', 'total_invoices')
      .addSelect('COALESCE(SUM(invoice.total_bs), 0)', 'total_amount_bs')
      .addSelect('COALESCE(SUM(invoice.total_usd), 0)', 'total_amount_usd')
      .addSelect('COALESCE(SUM(invoice.tax_amount_bs), 0)', 'total_tax_bs')
      .addSelect('COALESCE(SUM(invoice.tax_amount_usd), 0)', 'total_tax_usd')
      .getRawOne();

    const byStatusRows = await query
      .clone()
      .select('invoice.status', 'status')
      .addSelect('COUNT(invoice.id)', 'count')
      .groupBy('invoice.status')
      .getRawMany();

    const byTypeRows = await query
      .clone()
      .select('invoice.invoice_type', 'invoice_type')
      .addSelect('COUNT(invoice.id)', 'count')
      .groupBy('invoice.invoice_type')
      .getRawMany();

    const dailyRows = await query
      .clone()
      .select(dayExpr, 'date')
      .addSelect('COUNT(invoice.id)', 'invoices_count')
      .addSelect('COALESCE(SUM(invoice.total_bs), 0)', 'total_bs')
      .addSelect('COALESCE(SUM(invoice.total_usd), 0)', 'total_usd')
      .addSelect('COALESCE(SUM(invoice.tax_amount_bs), 0)', 'tax_bs')
      .addSelect('COALESCE(SUM(invoice.tax_amount_usd), 0)', 'tax_usd')
      .groupBy(dayExpr)
      .orderBy(dayExpr, 'ASC')
      .getRawMany();

    const by_status: Record<string, number> = {};
    for (const row of byStatusRows) {
      by_status[row.status] = Number(row.count || 0);
    }

    const by_type: Record<string, number> = {};
    for (const row of byTypeRows) {
      by_type[row.invoice_type] = Number(row.count || 0);
    }

    const daily = dailyRows.map((row) => ({
      date: row.date,
      invoices_count: Number(row.invoices_count || 0),
      total_bs: Number(row.total_bs || 0),
      total_usd: Number(row.total_usd || 0),
      tax_bs: Number(row.tax_bs || 0),
      tax_usd: Number(row.tax_usd || 0),
    }));

    return {
      total_invoices: Number(totalsAgg?.total_invoices || 0),
      total_amount_bs: Number(totalsAgg?.total_amount_bs || 0),
      total_amount_usd: Number(totalsAgg?.total_amount_usd || 0),
      total_tax_bs: Number(totalsAgg?.total_tax_bs || 0),
      total_tax_usd: Number(totalsAgg?.total_tax_usd || 0),
      by_status,
      by_type,
      daily,
    };
  }
}
