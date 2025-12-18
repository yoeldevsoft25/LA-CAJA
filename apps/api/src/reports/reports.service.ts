import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
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
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId });

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('sale.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('sale.sold_at <= :endDate', { endDate: end });
    }

    const sales = await query.getMany();

    const total_sales = sales.length;
    let total_amount_bs = 0;
    let total_amount_usd = 0;
    let total_cost_bs = 0;
    let total_cost_usd = 0;

    const by_payment_method: Record<
      string,
      { count: number; amount_bs: number; amount_usd: number }
    > = {};
    const dailyMap: Map<
      string,
      {
        sales_count: number;
        total_bs: number;
        total_usd: number;
        cost_bs: number;
        cost_usd: number;
      }
    > = new Map();

    // Cache de productos para evitar múltiples consultas
    const productCache = new Map<string, Product>();

    for (const sale of sales) {
      const totals = sale.totals || {};
      const total_bs = Number(totals.total_bs || 0);
      const total_usd = Number(totals.total_usd || 0);

      total_amount_bs += total_bs;
      total_amount_usd += total_usd;

      // Obtener items de la venta para calcular costos
      const saleItems = await this.saleItemRepository.find({
        where: { sale_id: sale.id },
      });

      let saleCostBs = 0;
      let saleCostUsd = 0;

      for (const item of saleItems) {
        // Obtener producto del cache o de la base de datos
        let product = productCache.get(item.product_id);
        if (!product) {
          const foundProduct = await this.productRepository.findOne({
            where: { id: item.product_id },
            select: ['id', 'cost_bs', 'cost_usd'],
          });
          if (foundProduct) {
            product = foundProduct;
            productCache.set(item.product_id, foundProduct);
          }
        }

        if (product) {
          saleCostBs += Number(product.cost_bs || 0) * item.qty;
          saleCostUsd += Number(product.cost_usd || 0) * item.qty;
        }
      }

      total_cost_bs += saleCostBs;
      total_cost_usd += saleCostUsd;

      // Por método de pago
      const payment = sale.payment || {};
      const method = payment.method || 'unknown';
      if (!by_payment_method[method]) {
        by_payment_method[method] = { count: 0, amount_bs: 0, amount_usd: 0 };
      }
      by_payment_method[method].count++;
      by_payment_method[method].amount_bs += total_bs;
      by_payment_method[method].amount_usd += total_usd;

      // Por día
      const dateKey = sale.sold_at.toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          sales_count: 0,
          total_bs: 0,
          total_usd: 0,
          cost_bs: 0,
          cost_usd: 0,
        });
      }
      const daily = dailyMap.get(dateKey)!;
      daily.sales_count++;
      daily.total_bs += total_bs;
      daily.total_usd += total_usd;
      daily.cost_bs += saleCostBs;
      daily.cost_usd += saleCostUsd;
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
        profit_bs: data.total_bs - data.cost_bs,
        profit_usd: data.total_usd - data.cost_usd,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const total_profit_bs = total_amount_bs - total_cost_bs;
    const total_profit_usd = total_amount_usd - total_cost_usd;
    const profit_margin =
      total_amount_usd > 0 ? (total_profit_usd / total_amount_usd) * 100 : 0;

    return {
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
      revenue_bs: number;
      revenue_usd: number;
      cost_bs: number;
      cost_usd: number;
      profit_bs: number;
      profit_usd: number;
      profit_margin: number;
    }>
  > {
    const query = this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.sale_id')
      .where('sale.store_id = :storeId', { storeId });

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('sale.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('sale.sold_at <= :endDate', { endDate: end });
    }

    const items = await query.getMany();

    const productMap = new Map<
      string,
      {
        product_name: string;
        quantity_sold: number;
        revenue_bs: number;
        revenue_usd: number;
        cost_bs: number;
        cost_usd: number;
      }
    >();

    for (const item of items) {
      const productId = item.product_id;
      if (!productMap.has(productId)) {
        // Obtener datos del producto
        const product = await this.productRepository.findOne({
          where: { id: productId, store_id: storeId },
          select: ['id', 'name', 'cost_bs', 'cost_usd'],
        });
        productMap.set(productId, {
          product_name: product?.name || 'Producto desconocido',
          quantity_sold: 0,
          revenue_bs: 0,
          revenue_usd: 0,
          cost_bs: 0,
          cost_usd: 0,
        });
      }

      const product = await this.productRepository.findOne({
        where: { id: productId },
        select: ['cost_bs', 'cost_usd'],
      });

      const productData = productMap.get(productId)!;
      productData.quantity_sold += item.qty;
      productData.revenue_bs +=
        Number(item.unit_price_bs || 0) * item.qty -
        Number(item.discount_bs || 0);
      productData.revenue_usd +=
        Number(item.unit_price_usd || 0) * item.qty -
        Number(item.discount_usd || 0);
      productData.cost_bs += Number(product?.cost_bs || 0) * item.qty;
      productData.cost_usd += Number(product?.cost_usd || 0) * item.qty;
    }

    return Array.from(productMap.entries())
      .map(([product_id, data]) => {
        const profit_bs = data.revenue_bs - data.cost_bs;
        const profit_usd = data.revenue_usd - data.cost_usd;
        const profit_margin =
          data.revenue_usd > 0 ? (profit_usd / data.revenue_usd) * 100 : 0;
        return {
          product_id,
          ...data,
          profit_bs,
          profit_usd,
          profit_margin,
        };
      })
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, limit);
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
    const debts = await this.debtRepository.find({
      where: { store_id: storeId },
      relations: ['payments'],
    });

    let total_debt_bs = 0;
    let total_debt_usd = 0;
    let total_paid_bs = 0;
    let total_paid_usd = 0;

    const by_status = {
      open: 0,
      partial: 0,
      paid: 0,
    };

    // Obtener todos los customer_ids únicos
    const customerIds = [
      ...new Set(debts.map((d) => d.customer_id).filter(Boolean)),
    ];
    const customers =
      customerIds.length > 0
        ? await this.customerRepository.find({
            where: { id: In(customerIds), store_id: storeId },
            select: ['id', 'name'],
          })
        : [];
    const customerMapByName = new Map(customers.map((c) => [c.id, c.name]));

    const customerMap = new Map<
      string,
      {
        customer_name: string;
        total_debt_bs: number;
        total_debt_usd: number;
        total_paid_bs: number;
        total_paid_usd: number;
      }
    >();

    for (const debt of debts) {
      const debt_bs = Number(debt.amount_bs || 0);
      const debt_usd = Number(debt.amount_usd || 0);

      total_debt_bs += debt_bs;
      total_debt_usd += debt_usd;

      // Contar por status
      if (debt.status === DebtStatus.OPEN) {
        by_status.open++;
      } else if (debt.status === DebtStatus.PARTIAL) {
        by_status.partial++;
      } else if (debt.status === DebtStatus.PAID) {
        by_status.paid++;
      }

      // Pagos
      const payments = debt.payments || [];
      let paid_bs = 0;
      let paid_usd = 0;
      for (const payment of payments) {
        paid_bs += Number(payment.amount_bs || 0);
        paid_usd += Number(payment.amount_usd || 0);
      }

      total_paid_bs += paid_bs;
      total_paid_usd += paid_usd;

      // Por cliente
      const customerId = debt.customer_id;
      if (!customerMap.has(customerId)) {
        const customerName =
          customerMapByName.get(customerId) ||
          `Cliente ${customerId.substring(0, 8)}`;
        customerMap.set(customerId, {
          customer_name: customerName,
          total_debt_bs: 0,
          total_debt_usd: 0,
          total_paid_bs: 0,
          total_paid_usd: 0,
        });
      }

      const customerData = customerMap.get(customerId)!;
      customerData.total_debt_bs += debt_bs;
      customerData.total_debt_usd += debt_usd;
      customerData.total_paid_bs += paid_bs;
      customerData.total_paid_usd += paid_usd;
    }

    const top_debtors = Array.from(customerMap.entries())
      .map(([customer_id, data]) => ({
        customer_id,
        ...data,
        pending_bs: data.total_debt_bs - data.total_paid_bs,
        pending_usd: data.total_debt_usd - data.total_paid_usd,
      }))
      .filter((d) => d.pending_bs > 0 || d.pending_usd > 0)
      .sort((a, b) => b.pending_bs - a.pending_bs)
      .slice(0, 10);

    return {
      total_debt_bs,
      total_debt_usd,
      total_paid_bs,
      total_paid_usd,
      total_pending_bs: total_debt_bs - total_paid_bs,
      total_pending_usd: total_debt_usd - total_paid_usd,
      by_status,
      top_debtors,
    };
  }

  async exportSalesCSV(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<string> {
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId });

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

    // Obtener items para cada venta
    for (const sale of sales) {
      const items = await this.saleItemRepository.find({
        where: { sale_id: sale.id },
      });

      const totals = sale.totals || {};
      const payment = sale.payment || {};
      const date = sale.sold_at.toISOString().split('T')[0];
      const method = payment.method || 'unknown';

      const itemsStr = items
        .map((item) => `${item.qty}x ${item.product_id}`)
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

    const shifts = await query
      .leftJoinAndSelect('shift.cashier', 'cashier')
      .orderBy('shift.opened_at', 'DESC')
      .getMany();

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

    for (const shift of shifts) {
      // Obtener ventas del turno
      const sales = await this.saleRepository
        .createQueryBuilder('sale')
        .where('sale.store_id = :storeId', { storeId })
        .andWhere('sale.sold_by_user_id = :cashierId', {
          cashierId: shift.cashier_id,
        })
        .andWhere('sale.sold_at >= :openedAt', { openedAt: shift.opened_at })
        .getMany();

      let shiftSalesBs = 0;
      let shiftSalesUsd = 0;

      for (const sale of sales) {
        const totals = sale.totals || {};
        shiftSalesBs += Number(totals.total_bs || 0);
        shiftSalesUsd += Number(totals.total_usd || 0);
      }

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
        sales_count: sales.length,
        total_sales_bs: shiftSalesBs,
        total_sales_usd: shiftSalesUsd,
        difference_bs: shift.difference_bs,
        difference_usd: shift.difference_usd,
      });
    }

    return {
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

    const shifts = await query
      .leftJoinAndSelect('shift.cashier', 'cashier')
      .orderBy('shift.closed_at', 'DESC')
      .getMany();

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
      const expected = (shift.expected_totals || {}) as {
        cash_bs?: number;
        cash_usd?: number;
        pago_movil_bs?: number;
        transfer_bs?: number;
        other_bs?: number;
        total_bs?: number;
        total_usd?: number;
      };
      const counted = (shift.counted_totals || {}) as {
        cash_bs?: number;
        cash_usd?: number;
        pago_movil_bs?: number;
        transfer_bs?: number;
        other_bs?: number;
      };
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
        shift.cashier?.full_name ||
        `Cajero ${shift.cashier_id.substring(0, 8)}`;

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
        shift_id: shift.id,
        cashier_id: shift.cashier_id,
        cashier_name: cashierName,
        closed_at: shift.closed_at!,
        expected_bs: Number(expected.cash_bs || 0),
        expected_usd: Number(expected.cash_usd || 0),
        counted_bs: Number(counted.cash_bs || 0),
        counted_usd: Number(counted.cash_usd || 0),
        difference_bs: diffBs,
        difference_usd: diffUsd,
      });
    }

    return {
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
    const now = new Date();
    const expirationLimit = new Date(now);
    expirationLimit.setDate(expirationLimit.getDate() + daysAhead);

    const lots = await this.productLotRepository
      .createQueryBuilder('lot')
      .innerJoin('lot.product', 'product')
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
      const product = await this.productRepository.findOne({
        where: { id: lot.product_id },
        select: ['id', 'name'],
      });

      if (!product) continue;

      const daysUntilExpiration = Math.ceil(
        (lot.expiration_date!.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (!productMap.has(lot.product_id)) {
        productMap.set(lot.product_id, {
          product_name: product.name,
          lots_count: 0,
          total_quantity: 0,
          expiration_dates: [],
        });
      }

      const productData = productMap.get(lot.product_id)!;
      productData.lots_count++;
      productData.total_quantity += lot.remaining_quantity;
      productData.expiration_dates.push({
        lot_number: lot.lot_number,
        expiration_date: lot.expiration_date!,
        quantity: lot.remaining_quantity,
        days_until_expiration: daysUntilExpiration,
      });

      total_quantity += lot.remaining_quantity;
      total_value_bs += Number(lot.unit_cost_bs || 0) * lot.remaining_quantity;
      total_value_usd +=
        Number(lot.unit_cost_usd || 0) * lot.remaining_quantity;
    }

    return {
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
    const query = this.productSerialRepository
      .createQueryBuilder('serial')
      .innerJoin('serial.product', 'product')
      .where('product.store_id = :storeId', { storeId });

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('serial.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('serial.sold_at <= :endDate', { endDate: end });
    }

    const serials = await query
      .leftJoinAndSelect('serial.sale', 'sale')
      .orderBy('serial.sold_at', 'DESC')
      .getMany();

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
      const product = await this.productRepository.findOne({
        where: { id: serial.product_id },
        select: ['id', 'name'],
      });

      if (!product) continue;

      if (!productMap.has(serial.product_id)) {
        productMap.set(serial.product_id, {
          product_name: product.name,
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
        product_name: product.name,
        serial_number: serial.serial_number,
        status: serial.status,
        sold_at: serial.sold_at,
        sale_id: serial.sale_id,
      });
    }

    return {
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
      revenue_bs: number;
      revenue_usd: number;
      cost_bs: number;
      cost_usd: number;
      profit_bs: number;
      profit_usd: number;
      profit_margin: number;
      rotation_rate: number; // Ventas / Stock promedio
    }>;
  }> {
    const query = this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.sale_id')
      .where('sale.store_id = :storeId', { storeId });

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('sale.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('sale.sold_at <= :endDate', { endDate: end });
    }

    const items = await query.getMany();

    const productMap = new Map<
      string,
      {
        product_name: string;
        quantity_sold: number;
        revenue_bs: number;
        revenue_usd: number;
        cost_bs: number;
        cost_usd: number;
      }
    >();

    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.product_id },
        select: ['id', 'name', 'cost_bs', 'cost_usd'],
      });

      if (!product) continue;

      if (!productMap.has(item.product_id)) {
        productMap.set(item.product_id, {
          product_name: product.name,
          quantity_sold: 0,
          revenue_bs: 0,
          revenue_usd: 0,
          cost_bs: 0,
          cost_usd: 0,
        });
      }

      const productData = productMap.get(item.product_id)!;
      productData.quantity_sold += item.qty;
      productData.revenue_bs +=
        Number(item.unit_price_bs || 0) * item.qty -
        Number(item.discount_bs || 0);
      productData.revenue_usd +=
        Number(item.unit_price_usd || 0) * item.qty -
        Number(item.discount_usd || 0);
      productData.cost_bs += Number(product.cost_bs || 0) * item.qty;
      productData.cost_usd += Number(product.cost_usd || 0) * item.qty;
    }

    return {
      by_product: Array.from(productMap.entries())
        .map(([product_id, data]) => {
          const profit_bs = data.revenue_bs - data.cost_bs;
          const profit_usd = data.revenue_usd - data.cost_usd;
          const profit_margin =
            data.revenue_usd > 0 ? (profit_usd / data.revenue_usd) * 100 : 0;

          // Rotación aproximada (ventas / 1, asumiendo stock promedio de 1)
          // En producción, se debería calcular el stock promedio real
          const rotation_rate = data.quantity_sold;

          return {
            product_id,
            ...data,
            profit_bs,
            profit_usd,
            profit_margin,
            rotation_rate,
          };
        })
        .sort((a, b) => b.rotation_rate - a.rotation_rate),
    };
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
    const query = this.purchaseOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.supplier', 'supplier')
      .where('order.store_id = :storeId', { storeId });

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('order.created_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('order.created_at <= :endDate', { endDate: end });
    }

    const orders = await query.getMany();

    const supplierMap = new Map<
      string,
      {
        supplier_id: string;
        supplier_name: string;
        supplier_code: string | null;
        orders_count: number;
        total_amount_bs: number;
        total_amount_usd: number;
        completed_orders: number;
        pending_orders: number;
      }
    >();

    let total_amount_bs = 0;
    let total_amount_usd = 0;

    for (const order of orders) {
      const supplierId = order.supplier_id;
      const supplier = order.supplier;

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplier_id: supplierId,
          supplier_name: supplier.name,
          supplier_code: supplier.code,
          orders_count: 0,
          total_amount_bs: 0,
          total_amount_usd: 0,
          completed_orders: 0,
          pending_orders: 0,
        });
      }

      const supplierData = supplierMap.get(supplierId)!;
      supplierData.orders_count++;
      supplierData.total_amount_bs += Number(order.total_amount_bs);
      supplierData.total_amount_usd += Number(order.total_amount_usd);

      if (order.status === 'completed') {
        supplierData.completed_orders++;
      } else if (
        ['draft', 'sent', 'confirmed', 'partial'].includes(order.status)
      ) {
        supplierData.pending_orders++;
      }

      total_amount_bs += Number(order.total_amount_bs);
      total_amount_usd += Number(order.total_amount_usd);
    }

    return {
      total_orders: orders.length,
      total_amount_bs,
      total_amount_usd,
      by_supplier: Array.from(supplierMap.values()).sort(
        (a, b) => b.total_amount_bs - a.total_amount_bs,
      ),
    };
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

    if (startDate) {
      const start = this.normalizeStartDate(new Date(startDate));
      query.andWhere('invoice.issued_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = this.normalizeEndDate(new Date(endDate));
      query.andWhere('invoice.issued_at <= :endDate', { endDate: end });
    }
    if (status) {
      query.andWhere('invoice.status = :status', { status });
    }

    // Solo facturas emitidas
    query.andWhere('invoice.status = :issuedStatus', {
      issuedStatus: 'issued',
    });

    const invoices = await query.getMany();

    let total_amount_bs = 0;
    let total_amount_usd = 0;
    let total_tax_bs = 0;
    let total_tax_usd = 0;
    const by_status: Record<string, number> = {};
    const by_type: Record<string, number> = {};
    const dailyMap = new Map<
      string,
      {
        invoices_count: number;
        total_bs: number;
        total_usd: number;
        tax_bs: number;
        tax_usd: number;
      }
    >();

    for (const invoice of invoices) {
      total_amount_bs += Number(invoice.total_bs);
      total_amount_usd += Number(invoice.total_usd);
      total_tax_bs += Number(invoice.tax_amount_bs);
      total_tax_usd += Number(invoice.tax_amount_usd);

      by_status[invoice.status] = (by_status[invoice.status] || 0) + 1;
      by_type[invoice.invoice_type] = (by_type[invoice.invoice_type] || 0) + 1;

      if (invoice.issued_at) {
        const dateKey = invoice.issued_at.toISOString().split('T')[0];
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, {
            invoices_count: 0,
            total_bs: 0,
            total_usd: 0,
            tax_bs: 0,
            tax_usd: 0,
          });
        }

        const dayData = dailyMap.get(dateKey)!;
        dayData.invoices_count++;
        dayData.total_bs += Number(invoice.total_bs);
        dayData.total_usd += Number(invoice.total_usd);
        dayData.tax_bs += Number(invoice.tax_amount_bs);
        dayData.tax_usd += Number(invoice.tax_amount_usd);
      }
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total_invoices: invoices.length,
      total_amount_bs,
      total_amount_usd,
      total_tax_bs,
      total_tax_usd,
      by_status,
      by_type,
      daily,
    };
  }
}
