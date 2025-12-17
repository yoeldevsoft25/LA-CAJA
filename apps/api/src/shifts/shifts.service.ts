import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Shift, ShiftStatus } from '../database/entities/shift.entity';
import { ShiftCut, CutType } from '../database/entities/shift-cut.entity';
import { Sale } from '../database/entities/sale.entity';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { randomUUID } from 'crypto';

/**
 * Servicio para gestión de turnos de cajeros y cortes X/Z
 */
@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
    @InjectRepository(ShiftCut)
    private shiftCutRepository: Repository<ShiftCut>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    private dataSource: DataSource,
  ) {}

  /**
   * Abre un nuevo turno para un cajero
   * Valida que no haya un turno abierto para el mismo cajero
   */
  async openShift(
    storeId: string,
    cashierId: string,
    dto: OpenShiftDto,
  ): Promise<Shift> {
    // Verificar si hay un turno abierto para este cajero
    const openShift = await this.shiftRepository.findOne({
      where: {
        store_id: storeId,
        cashier_id: cashierId,
        status: ShiftStatus.OPEN,
      },
    });

    if (openShift) {
      throw new BadRequestException(
        'Ya existe un turno abierto para este cajero. Debe cerrarlo antes de abrir uno nuevo.',
      );
    }

    const shift = this.shiftRepository.create({
      id: randomUUID(),
      store_id: storeId,
      cashier_id: cashierId,
      opened_at: new Date(),
      opening_amount_bs: dto.opening_amount_bs,
      opening_amount_usd: dto.opening_amount_usd,
      note: dto.note || null,
      status: ShiftStatus.OPEN,
    });

    return this.shiftRepository.save(shift);
  }

  /**
   * Obtiene el turno actual abierto de un cajero
   */
  async getCurrentShift(
    storeId: string,
    cashierId: string,
  ): Promise<Shift | null> {
    return this.shiftRepository.findOne({
      where: {
        store_id: storeId,
        cashier_id: cashierId,
        status: ShiftStatus.OPEN,
      },
      relations: ['cuts'],
      order: {
        opened_at: 'DESC',
      },
    });
  }

  /**
   * Cierra un turno con arqueo
   * Calcula totales esperados basados en las ventas del turno
   */
  async closeShift(
    storeId: string,
    cashierId: string,
    shiftId: string,
    dto: CloseShiftDto,
  ): Promise<Shift> {
    // Validar formato de montos (redondeo a 2 decimales)
    const countedBs = Math.round(Number(dto.counted_bs) * 100) / 100;
    const countedUsd = Math.round(Number(dto.counted_usd) * 100) / 100;
    const countedPagoMovil =
      Math.round(Number(dto.counted_pago_movil_bs || 0) * 100) / 100;
    const countedTransfer =
      Math.round(Number(dto.counted_transfer_bs || 0) * 100) / 100;
    const countedOther =
      Math.round(Number(dto.counted_other_bs || 0) * 100) / 100;

    if (isNaN(countedBs) || isNaN(countedUsd)) {
      throw new BadRequestException('Los montos deben ser números válidos');
    }

    if (countedBs < 0 || countedUsd < 0) {
      throw new BadRequestException(
        'Los montos contados no pueden ser negativos',
      );
    }

    // Obtener turno y validar
    const shift = await this.shiftRepository.findOne({
      where: {
        id: shiftId,
        store_id: storeId,
        cashier_id: cashierId,
        status: ShiftStatus.OPEN,
      },
    });

    if (!shift) {
      throw new NotFoundException(
        'Turno no encontrado, ya está cerrado o no pertenece a este cajero',
      );
    }

    // Calcular totales esperados basados en las ventas del turno
    // Las ventas se relacionan con el turno por fecha y cajero (sold_by_user_id)
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_by_user_id = :cashierId', { cashierId })
      .andWhere('sale.sold_at >= :openedAt', { openedAt: shift.opened_at })
      .andWhere('sale.payment IS NOT NULL');

    if (shift.closed_at) {
      query.andWhere('sale.sold_at <= :closedAt', {
        closedAt: shift.closed_at,
      });
    }

    const sales = await query.getMany();

    // Calcular totales esperados
    const expected = this.calculateExpectedTotals(shift, sales);

    // Calcular diferencias
    const differenceBs = Math.round((countedBs - expected.cash_bs) * 100) / 100;
    const differenceUsd =
      Math.round((countedUsd - expected.cash_usd) * 100) / 100;

    // Validar montos razonables
    const maxReasonableBs =
      (expected.cash_bs + Number(shift.opening_amount_bs || 0)) * 2;
    const maxReasonableUsd =
      (expected.cash_usd + Number(shift.opening_amount_usd || 0)) * 2;

    if (countedBs > maxReasonableBs) {
      throw new BadRequestException(
        `El monto contado en Bs (${countedBs.toFixed(2)}) es excesivamente alto. Máximo razonable: ${maxReasonableBs.toFixed(2)}`,
      );
    }

    if (countedUsd > maxReasonableUsd) {
      throw new BadRequestException(
        `El monto contado en USD (${countedUsd.toFixed(2)}) es excesivamente alto. Máximo razonable: ${maxReasonableUsd.toFixed(2)}`,
      );
    }

    // Cerrar turno
    const closedAt = new Date();
    shift.closed_at = closedAt;
    shift.closing_amount_bs = countedBs;
    shift.closing_amount_usd = countedUsd;
    shift.expected_totals = expected;
    shift.counted_totals = {
      cash_bs: countedBs,
      cash_usd: countedUsd,
      pago_movil_bs: countedPagoMovil,
      transfer_bs: countedTransfer,
      other_bs: countedOther,
    };
    shift.difference_bs = differenceBs;
    shift.difference_usd = differenceUsd;
    shift.status = ShiftStatus.CLOSED;
    shift.note = dto.note || shift.note;

    return this.shiftRepository.save(shift);
  }

  /**
   * Calcula los totales esperados basados en las ventas del turno
   */
  private calculateExpectedTotals(
    shift: Shift,
    sales: Sale[],
  ): {
    cash_bs: number;
    cash_usd: number;
    pago_movil_bs: number;
    transfer_bs: number;
    other_bs: number;
    total_bs: number;
    total_usd: number;
  } {
    let cashBs = Math.round(Number(shift.opening_amount_bs || 0) * 100) / 100;
    let cashUsd = Math.round(Number(shift.opening_amount_usd || 0) * 100) / 100;
    let pagoMovilBs = 0;
    let transferBs = 0;
    let otherBs = 0;
    let totalBs = 0;
    let totalUsd = 0;

    for (const sale of sales) {
      const payment = sale.payment as any;
      const totals = sale.totals as any;

      if (!payment || !totals) continue;

      const saleTotalBs = Math.round(Number(totals.total_bs || 0) * 100) / 100;
      const saleTotalUsd =
        Math.round(Number(totals.total_usd || 0) * 100) / 100;

      totalBs += saleTotalBs;
      totalUsd += saleTotalUsd;

      // Lógica similar a CashService para calcular efectivo
      if (payment.method === 'CASH_BS') {
        if (payment.cash_payment_bs?.received_bs) {
          const receivedBs =
            Math.round(Number(payment.cash_payment_bs.received_bs) * 100) / 100;
          cashBs = Math.round((cashBs + receivedBs) * 100) / 100;

          if (
            payment.cash_payment_bs.change_bs &&
            payment.cash_payment_bs.change_bs > 0
          ) {
            const changeBs =
              Math.round(Number(payment.cash_payment_bs.change_bs) * 100) / 100;
            cashBs = Math.round((cashBs - changeBs) * 100) / 100;
          }
        } else {
          cashBs = Math.round((cashBs + saleTotalBs) * 100) / 100;
        }
      } else if (payment.method === 'CASH_USD') {
        if (payment.cash_payment?.received_usd) {
          const receivedUsd =
            Math.round(Number(payment.cash_payment.received_usd) * 100) / 100;
          cashUsd = Math.round((cashUsd + receivedUsd) * 100) / 100;

          if (
            payment.cash_payment.change_bs &&
            payment.cash_payment.change_bs > 0
          ) {
            const changeBs =
              Math.round(Number(payment.cash_payment.change_bs) * 100) / 100;
            cashBs = Math.round((cashBs - changeBs) * 100) / 100;
          }
        } else {
          cashUsd = Math.round((cashUsd + saleTotalUsd) * 100) / 100;
        }
      } else if (payment.method === 'PAGO_MOVIL') {
        pagoMovilBs += saleTotalBs;
      } else if (payment.method === 'TRANSFER') {
        transferBs += saleTotalBs;
      } else if (payment.method === 'OTHER') {
        otherBs += saleTotalBs;
      } else if (payment.method === 'SPLIT' && payment.split) {
        const splitCashBs =
          Math.round(Number(payment.split.cash_bs || 0) * 100) / 100;
        const splitCashUsd =
          Math.round(Number(payment.split.cash_usd || 0) * 100) / 100;
        cashBs = Math.round((cashBs + splitCashBs) * 100) / 100;
        cashUsd = Math.round((cashUsd + splitCashUsd) * 100) / 100;

        if (payment.split.pago_movil_bs) {
          pagoMovilBs +=
            Math.round(Number(payment.split.pago_movil_bs) * 100) / 100;
        }
        if (payment.split.transfer_bs) {
          transferBs +=
            Math.round(Number(payment.split.transfer_bs) * 100) / 100;
        }
        if (payment.split.other_bs) {
          otherBs += Math.round(Number(payment.split.other_bs) * 100) / 100;
        }
      }
    }

    return {
      cash_bs: cashBs,
      cash_usd: cashUsd,
      pago_movil_bs: pagoMovilBs,
      transfer_bs: transferBs,
      other_bs: otherBs,
      total_bs: totalBs,
      total_usd: totalUsd,
    };
  }

  /**
   * Crea un corte X (intermedio) para un turno
   */
  async createCutX(
    storeId: string,
    cashierId: string,
    shiftId: string,
    userId: string,
  ): Promise<ShiftCut> {
    const shift = await this.validateShiftForCut(storeId, cashierId, shiftId);

    const totals = await this.calculateCutTotals(shift);

    const cut = this.shiftCutRepository.create({
      id: randomUUID(),
      shift_id: shiftId,
      cut_type: CutType.X,
      cut_at: new Date(),
      totals,
      sales_count: totals.sales_count,
      created_by: userId,
    });

    return this.shiftCutRepository.save(cut);
  }

  /**
   * Crea un corte Z (final) para un turno
   * Solo se puede crear si el turno está cerrado
   */
  async createCutZ(
    storeId: string,
    cashierId: string,
    shiftId: string,
    userId: string,
  ): Promise<ShiftCut> {
    const shift = await this.shiftRepository.findOne({
      where: {
        id: shiftId,
        store_id: storeId,
        cashier_id: cashierId,
        status: ShiftStatus.CLOSED,
      },
    });

    if (!shift) {
      throw new NotFoundException(
        'Turno no encontrado o no está cerrado. Debe cerrar el turno antes de crear un corte Z.',
      );
    }

    const totals = await this.calculateCutTotals(shift, true);

    const cut = this.shiftCutRepository.create({
      id: randomUUID(),
      shift_id: shiftId,
      cut_type: CutType.Z,
      cut_at: new Date(),
      totals,
      sales_count: totals.sales_count,
      created_by: userId,
    });

    return this.shiftCutRepository.save(cut);
  }

  /**
   * Valida que el turno existe y está abierto para crear un corte X
   */
  private async validateShiftForCut(
    storeId: string,
    cashierId: string,
    shiftId: string,
  ): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({
      where: {
        id: shiftId,
        store_id: storeId,
        cashier_id: cashierId,
        status: ShiftStatus.OPEN,
      },
    });

    if (!shift) {
      throw new NotFoundException(
        'Turno no encontrado, ya está cerrado o no pertenece a este cajero',
      );
    }

    return shift;
  }

  /**
   * Calcula los totales para un corte
   */
  private async calculateCutTotals(
    shift: Shift,
    isFinal: boolean = false,
  ): Promise<{
    sales_count: number;
    total_bs: number;
    total_usd: number;
    by_payment_method: Record<string, number>;
    cash_bs: number;
    cash_usd: number;
    pago_movil_bs: number;
    transfer_bs: number;
    other_bs: number;
  }> {
    const query = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId: shift.store_id })
      .andWhere('sale.sold_by_user_id = :cashierId', {
        cashierId: shift.cashier_id,
      })
      .andWhere('sale.sold_at >= :openedAt', { openedAt: shift.opened_at })
      .andWhere('sale.payment IS NOT NULL');

    if (isFinal && shift.closed_at) {
      query.andWhere('sale.sold_at <= :closedAt', {
        closedAt: shift.closed_at,
      });
    }

    const sales = await query.getMany();

    const totals = {
      sales_count: sales.length,
      total_bs: 0,
      total_usd: 0,
      by_payment_method: {
        CASH_BS: 0,
        CASH_USD: 0,
        PAGO_MOVIL: 0,
        TRANSFER: 0,
        OTHER: 0,
        FIAO: 0,
        SPLIT: 0,
      },
      cash_bs: 0,
      cash_usd: 0,
      pago_movil_bs: 0,
      transfer_bs: 0,
      other_bs: 0,
    };

    for (const sale of sales) {
      const payment = sale.payment as any;
      const saleTotals = sale.totals as any;

      if (!payment || !saleTotals) continue;

      const totalBs = Math.round(Number(saleTotals.total_bs || 0) * 100) / 100;
      const totalUsd =
        Math.round(Number(saleTotals.total_usd || 0) * 100) / 100;

      totals.total_bs += totalBs;
      totals.total_usd += totalUsd;

      const method = payment.method || 'OTHER';
      if (method in totals.by_payment_method) {
        totals.by_payment_method[method] += totalBs;
      }

      // Calcular por método de pago
      if (method === 'CASH_BS') {
        totals.cash_bs += totalBs;
      } else if (method === 'CASH_USD') {
        totals.cash_usd += totalUsd;
      } else if (method === 'PAGO_MOVIL') {
        totals.pago_movil_bs += totalBs;
      } else if (method === 'TRANSFER') {
        totals.transfer_bs += totalBs;
      } else if (method === 'OTHER') {
        totals.other_bs += totalBs;
      } else if (method === 'SPLIT' && payment.split) {
        totals.cash_bs += Number(payment.split.cash_bs || 0);
        totals.cash_usd += Number(payment.split.cash_usd || 0);
        totals.pago_movil_bs += Number(payment.split.pago_movil_bs || 0);
        totals.transfer_bs += Number(payment.split.transfer_bs || 0);
        totals.other_bs += Number(payment.split.other_bs || 0);
      }
    }

    return totals;
  }

  /**
   * Obtiene todos los cortes de un turno
   */
  async getCuts(shiftId: string, storeId: string): Promise<ShiftCut[]> {
    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId, store_id: storeId },
    });

    if (!shift) {
      throw new NotFoundException('Turno no encontrado');
    }

    return this.shiftCutRepository.find({
      where: { shift_id: shiftId },
      order: { cut_at: 'ASC' },
      relations: ['creator'],
    });
  }

  /**
   * Marca un corte como impreso
   */
  async markCutAsPrinted(cutId: string, shiftId: string): Promise<ShiftCut> {
    const cut = await this.shiftCutRepository.findOne({
      where: { id: cutId, shift_id: shiftId },
    });

    if (!cut) {
      throw new NotFoundException('Corte no encontrado');
    }

    cut.printed_at = new Date();
    return this.shiftCutRepository.save(cut);
  }

  /**
   * Obtiene el resumen de un turno
   */
  async getShiftSummary(shiftId: string, storeId: string): Promise<any> {
    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId, store_id: storeId },
      relations: ['cashier', 'cuts', 'cuts.creator'],
    });

    if (!shift) {
      throw new NotFoundException('Turno no encontrado');
    }

    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.sold_at >= :openedAt', { openedAt: shift.opened_at })
      .getMany();

    return {
      shift,
      sales_count: sales.length,
      cuts_count: shift.cuts?.length || 0,
      summary: {
        opening: {
          bs: shift.opening_amount_bs,
          usd: shift.opening_amount_usd,
        },
        expected: shift.expected_totals,
        counted: shift.counted_totals,
        difference: {
          bs: shift.difference_bs,
          usd: shift.difference_usd,
        },
      },
    };
  }

  /**
   * Lista turnos de un cajero
   */
  async listShifts(
    storeId: string,
    cashierId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ shifts: Shift[]; total: number }> {
    const query = this.shiftRepository
      .createQueryBuilder('shift')
      .where('shift.store_id = :storeId', { storeId })
      .andWhere('shift.cashier_id = :cashierId', { cashierId })
      .orderBy('shift.opened_at', 'DESC');

    const total = await query.getCount();
    query.limit(limit).offset(offset);

    const shifts = await query.getMany();

    return { shifts, total };
  }
}
