import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Customer } from '../database/entities/customer.entity';
import { Sale } from '../database/entities/sale.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { randomUUID } from 'crypto';

export interface CustomerPurchaseHistory {
  total_purchases: number;
  total_amount_usd: number;
  total_amount_bs: number;
  first_purchase_at: Date | null;
  last_purchase_at: Date | null;
  average_purchase_usd: number;
  recent_sales: Array<{
    id: string;
    sale_number: number | null;
    sold_at: Date;
    total_usd: number;
    total_bs: number;
    payment_method: string;
  }>;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    private dataSource: DataSource,
  ) {}

  async create(storeId: string, dto: CreateCustomerDto): Promise<Customer> {
    const now = new Date();
    const customer = this.customerRepository.create({
      id: randomUUID(),
      store_id: storeId,
      name: dto.name,
      document_id: dto.document_id || null,
      phone: dto.phone || null,
      email: dto.email || null,
      credit_limit: dto.credit_limit ?? null,
      note: dto.note || null,
      created_at: now,
      updated_at: now,
    });

    return this.customerRepository.save(customer);
  }

  async findAll(storeId: string, search?: string): Promise<Customer[]> {
    const query = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.store_id = :storeId', { storeId });

    if (search) {
      query.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.document_id ILIKE :search OR customer.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('customer.name', 'ASC');

    return query.getMany();
  }

  async findOne(storeId: string, customerId: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, store_id: storeId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  async update(
    storeId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findOne(storeId, customerId);

    if (dto.name !== undefined) {
      customer.name = dto.name;
    }
    if (dto.document_id !== undefined) {
      customer.document_id = dto.document_id || null;
    }
    if (dto.phone !== undefined) {
      customer.phone = dto.phone || null;
    }
    if (dto.email !== undefined) {
      customer.email = dto.email || null;
    }
    if (dto.credit_limit !== undefined) {
      customer.credit_limit = dto.credit_limit;
    }
    if (dto.note !== undefined) {
      customer.note = dto.note || null;
    }
    customer.updated_at = new Date();

    return this.customerRepository.save(customer);
  }

  /**
   * Get customer's purchase history including summary and recent sales
   */
  async getPurchaseHistory(
    storeId: string,
    customerId: string,
    limit = 10,
  ): Promise<CustomerPurchaseHistory> {
    // Verify customer exists
    await this.findOne(storeId, customerId);

    // Get aggregated stats
    const stats = await this.dataSource.query(
      `
      SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM((totals->>'total_usd')::numeric), 0) as total_amount_usd,
        COALESCE(SUM((totals->>'total_bs')::numeric), 0) as total_amount_bs,
        MIN(sold_at) as first_purchase_at,
        MAX(sold_at) as last_purchase_at
      FROM sales
      WHERE store_id = $1 
        AND customer_id = $2
        AND voided_at IS NULL
    `,
      [storeId, customerId],
    );

    const totalPurchases = parseInt(stats[0]?.total_purchases || '0', 10);
    const totalAmountUsd = parseFloat(stats[0]?.total_amount_usd || '0');
    const totalAmountBs = parseFloat(stats[0]?.total_amount_bs || '0');

    // Get recent sales
    const recentSales = await this.saleRepository
      .createQueryBuilder('sale')
      .select([
        'sale.id',
        'sale.sale_number',
        'sale.sold_at',
        'sale.totals',
        'sale.payment',
      ])
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.customer_id = :customerId', { customerId })
      .andWhere('sale.voided_at IS NULL')
      .orderBy('sale.sold_at', 'DESC')
      .take(limit)
      .getMany();

    return {
      total_purchases: totalPurchases,
      total_amount_usd: Math.round(totalAmountUsd * 100) / 100,
      total_amount_bs: Math.round(totalAmountBs * 100) / 100,
      first_purchase_at: stats[0]?.first_purchase_at || null,
      last_purchase_at: stats[0]?.last_purchase_at || null,
      average_purchase_usd:
        totalPurchases > 0
          ? Math.round((totalAmountUsd / totalPurchases) * 100) / 100
          : 0,
      recent_sales: recentSales.map((sale) => ({
        id: sale.id,
        sale_number: sale.sale_number,
        sold_at: sale.sold_at,
        total_usd: Number(sale.totals?.total_usd || 0),
        total_bs: Number(sale.totals?.total_bs || 0),
        payment_method: (sale.payment as any)?.method || 'UNKNOWN',
      })),
    };
  }

  /**
   * Check if customer has available credit for a FIAO purchase
   */
  async checkCreditAvailable(
    storeId: string,
    customerId: string,
    amountUsd: number,
  ): Promise<{
    available: boolean;
    credit_limit: number | null;
    current_debt: number;
    available_credit: number;
    message: string;
  }> {
    const customer = await this.findOne(storeId, customerId);

    // If no credit limit set, credit is not allowed
    if (customer.credit_limit === null || customer.credit_limit <= 0) {
      return {
        available: false,
        credit_limit: customer.credit_limit,
        current_debt: 0,
        available_credit: 0,
        message: 'El cliente no tiene crédito habilitado',
      };
    }

    // Get current debt from debts table
    const debtResult = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(
        amount_usd - COALESCE((
          SELECT SUM(amount_usd) FROM debt_payments WHERE debt_id = d.id
        ), 0)
      ), 0) as current_debt
      FROM debts d
      WHERE store_id = $1 
        AND customer_id = $2
        AND status != 'paid'
    `,
      [storeId, customerId],
    );

    const currentDebt = parseFloat(debtResult[0]?.current_debt || '0');
    const availableCredit = Number(customer.credit_limit) - currentDebt;

    if (availableCredit < amountUsd) {
      return {
        available: false,
        credit_limit: Number(customer.credit_limit),
        current_debt: Math.round(currentDebt * 100) / 100,
        available_credit: Math.round(availableCredit * 100) / 100,
        message: `Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)}`,
      };
    }

    return {
      available: true,
      credit_limit: Number(customer.credit_limit),
      current_debt: Math.round(currentDebt * 100) / 100,
      available_credit: Math.round(availableCredit * 100) / 100,
      message: 'Crédito disponible',
    };
  }
}
