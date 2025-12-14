import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { Product } from '../database/entities/product.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { Debt } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { Customer } from '../database/entities/customer.entity';
import { DebtStatus } from '../database/entities/debt.entity';

@Injectable()
export class ReportsService {
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
    by_payment_method: Record<string, { count: number; amount_bs: number; amount_usd: number }>;
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
      // Asegurar que la fecha de inicio sea al inicio del día en hora local
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.andWhere('sale.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      // Asegurar que la fecha de fin sea al final del día
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere('sale.sold_at <= :endDate', { endDate: end });
    }

    const sales = await query.getMany();

    const total_sales = sales.length;
    let total_amount_bs = 0;
    let total_amount_usd = 0;
    let total_cost_bs = 0;
    let total_cost_usd = 0;

    const by_payment_method: Record<string, { count: number; amount_bs: number; amount_usd: number }> = {};
    const dailyMap: Map<string, {
      sales_count: number;
      total_bs: number;
      total_usd: number;
      cost_bs: number;
      cost_usd: number;
    }> = new Map();

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
        dailyMap.set(dateKey, { sales_count: 0, total_bs: 0, total_usd: 0, cost_bs: 0, cost_usd: 0 });
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
    const profit_margin = total_amount_usd > 0
      ? (total_profit_usd / total_amount_usd) * 100
      : 0;

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
  ): Promise<Array<{
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
  }>> {
    const query = this.saleItemRepository
      .createQueryBuilder('item')
      .innerJoin(Sale, 'sale', 'sale.id = item.sale_id')
      .where('sale.store_id = :storeId', { storeId });

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.andWhere('sale.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
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
      productData.revenue_bs += Number(item.unit_price_bs || 0) * item.qty - Number(item.discount_bs || 0);
      productData.revenue_usd += Number(item.unit_price_usd || 0) * item.qty - Number(item.discount_usd || 0);
      productData.cost_bs += Number(product?.cost_bs || 0) * item.qty;
      productData.cost_usd += Number(product?.cost_usd || 0) * item.qty;
    }

    return Array.from(productMap.entries())
      .map(([product_id, data]) => {
        const profit_bs = data.revenue_bs - data.cost_bs;
        const profit_usd = data.revenue_usd - data.cost_usd;
        const profit_margin = data.revenue_usd > 0
          ? (profit_usd / data.revenue_usd) * 100
          : 0;
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

  async getDebtSummary(
    storeId: string,
  ): Promise<{
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
    const customerIds = [...new Set(debts.map((d) => d.customer_id).filter(Boolean))];
    const customers = customerIds.length > 0
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
        const customerName = customerMapByName.get(customerId) || `Cliente ${customerId.substring(0, 8)}`;
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
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.andWhere('sale.sold_at >= :startDate', { startDate: start });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere('sale.sold_at <= :endDate', { endDate: end });
    }

    query.orderBy('sale.sold_at', 'DESC');

    const sales = await query.getMany();

    // Generar CSV
    const headers = ['Fecha', 'ID Venta', 'Total BS', 'Total USD', 'Método de Pago', 'Items'];
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
}

