import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  In,
} from 'typeorm';
import { Sale } from '../../../../database/entities/sale.entity';
import { Debt } from '../../../../database/entities/debt.entity';
import { DebtPayment } from '../../../../database/entities/debt-payment.entity';
import { GetSalesListQuery } from './get-sales-list.query';

interface DebtWithCalculations {
  id: string;
  sale_id: string | null;
  status: string;
  amount_bs: number;
  amount_usd: number;
  total_paid_bs: number;
  total_paid_usd: number;
  remaining_bs: number;
  remaining_usd: number;
}

@QueryHandler(GetSalesListQuery)
export class GetSalesListHandler implements IQueryHandler<GetSalesListQuery> {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Debt)
    private readonly debtRepository: Repository<Debt>,
  ) {}

  async execute(
    query: GetSalesListQuery,
  ): Promise<{ sales: Sale[]; total: number }> {
    const { storeId, limit, offset, dateFrom, dateTo } = query;

    // Query para contar total (sin joins para mejor rendimiento)
    const countQuery = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId });

    if (dateFrom) {
      countQuery.andWhere('sale.sold_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      countQuery.andWhere('sale.sold_at <= :dateTo', { dateTo });
    }

    const total = await countQuery.getCount();
    const whereConditions: {
      store_id: string;
      sold_at?: import('typeorm').FindOperator<Date>;
    } = { store_id: storeId };

    if (dateFrom && dateTo) {
      whereConditions.sold_at = Between(dateFrom, dateTo);
    } else if (dateFrom) {
      whereConditions.sold_at = MoreThanOrEqual(dateFrom);
    } else if (dateTo) {
      whereConditions.sold_at = LessThanOrEqual(dateTo);
    }

    const sales = await this.saleRepository.find({
      where: whereConditions,
      relations: ['items', 'items.product', 'sold_by_user', 'customer'],
      order: { sold_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Cargar deudas por separado para evitar problemas con el join
    const saleIds = sales.map((s) => s.id);
    const debts =
      saleIds.length > 0
        ? await this.debtRepository.find({
            where: { sale_id: In(saleIds) },
            relations: ['payments'],
            select: ['id', 'sale_id', 'status', 'amount_bs', 'amount_usd'],
          })
        : [];

    // Mapear deudas por sale_id y calcular montos pendientes
    const debtsBySaleId = new Map<string, DebtWithCalculations>();
    for (const debt of debts) {
      if (debt.sale_id) {
        // Calcular montos pagados
        const payments = debt.payments || [];
        const totalPaidBs = payments.reduce(
          (sum: number, p: DebtPayment) => sum + Number(p.amount_bs || 0),
          0,
        );
        const totalPaidUsd = payments.reduce(
          (sum: number, p: DebtPayment) => sum + Number(p.amount_usd || 0),
          0,
        );

        // Calcular montos pendientes
        const debtAmountBs = Number(debt.amount_bs || 0);
        const debtAmountUsd = Number(debt.amount_usd || 0);
        const remainingBs = debtAmountBs - totalPaidBs;
        const remainingUsd = debtAmountUsd - totalPaidUsd;

        // Agregar información calculada a la deuda
        const debtWithCalculations: DebtWithCalculations = {
          id: debt.id,
          sale_id: debt.sale_id,
          status: debt.status,
          amount_bs: Number(debt.amount_bs || 0),
          amount_usd: Number(debt.amount_usd || 0),
          total_paid_bs: totalPaidBs,
          total_paid_usd: totalPaidUsd,
          remaining_bs: remainingBs,
          remaining_usd: remainingUsd,
        };

        debtsBySaleId.set(debt.sale_id, debtWithCalculations);
      }
    }

    // Asignar deudas a las ventas
    type SaleWithDebt = Sale & { debt?: DebtWithCalculations | null };
    for (const sale of sales) {
      (sale as SaleWithDebt).debt = debtsBySaleId.get(sale.id) || null;
    }

    // Asegurar que items siempre sea un array (incluso si está vacío)
    for (const sale of sales) {
      if (!sale.items) {
        sale.items = [];
      }
    }

    return { sales, total };
  }
}
