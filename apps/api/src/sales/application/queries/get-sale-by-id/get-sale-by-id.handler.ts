import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../../../../database/entities/sale.entity';
import { DebtPayment } from '../../../../database/entities/debt-payment.entity';
import { FiscalInvoicesService } from '../../../../fiscal-invoices/fiscal-invoices.service';
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { GetSaleByIdQuery } from './get-sale-by-id.query';

@QueryHandler(GetSaleByIdQuery)
export class GetSaleByIdHandler implements IQueryHandler<GetSaleByIdQuery> {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(DebtPayment)
    private readonly debtPaymentRepository: Repository<DebtPayment>,
    private readonly fiscalInvoicesService: FiscalInvoicesService,
  ) {}

  async execute(query: GetSaleByIdQuery): Promise<Sale> {
    const { storeId, saleId } = query;

    // Validar que storeId esté presente
    if (!storeId) {
      throw new BadRequestException('Store ID es requerido');
    }

    const sale = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('sale.sold_by_user', 'sold_by_user')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoin('debts', 'debt', 'debt.sale_id = sale.id')
      .addSelect([
        'debt.id',
        'debt.status',
        'debt.amount_bs',
        'debt.amount_usd',
      ])
      .where('sale.id = :saleId', { saleId })
      .andWhere('sale.store_id = :storeId', { storeId })
      .getOne();

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    // Validación adicional de seguridad: asegurar que la venta pertenece a la tienda
    if (sale.store_id !== storeId) {
      throw new UnauthorizedException('No tienes permisos para ver esta venta');
    }

    // Agregar información de pagos si hay deuda (optimizado)
    const saleWithDebt = sale as any;
    if (saleWithDebt.debt) {
      // Obtener pagos directamente sin cargar toda la relación
      const payments = await this.debtPaymentRepository.find({
        where: { debt_id: saleWithDebt.debt.id },
        select: ['amount_bs', 'amount_usd'],
      });

      const totalPaidBs = payments.reduce(
        (sum: number, p: any) => sum + Number(p.amount_bs || 0),
        0,
      );
      const totalPaidUsd = payments.reduce(
        (sum: number, p: any) => sum + Number(p.amount_usd || 0),
        0,
      );
      saleWithDebt.debt.total_paid_bs = totalPaidBs;
      saleWithDebt.debt.total_paid_usd = totalPaidUsd;
      saleWithDebt.debt.remaining_bs =
        Number(saleWithDebt.debt.amount_bs || 0) - totalPaidBs;
      saleWithDebt.debt.remaining_usd =
        Number(saleWithDebt.debt.amount_usd || 0) - totalPaidUsd;
    }

    // Agregar información de factura fiscal si existe
    try {
      const fiscalInvoice = await this.fiscalInvoicesService.findBySale(
        storeId,
        saleId,
      );
      if (fiscalInvoice) {
        saleWithDebt.fiscal_invoice = fiscalInvoice;
      } else {
        saleWithDebt.fiscal_invoice = null;
      }
    } catch (error) {
      // Ignorar errores de factura fiscal para no bloquear la venta
      saleWithDebt.fiscal_invoice = null;
    }

    return sale;
  }
}
