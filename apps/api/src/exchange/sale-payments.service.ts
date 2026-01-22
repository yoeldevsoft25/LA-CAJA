import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SalePayment,
  SaleChange,
  PaymentMethod,
  PaymentStatus,
  ChangeMethod,
  ExcessAction,
  ChangeBreakdown,
} from '../database/entities';
import {
  ExchangeService,
  toCents,
  fromCents,
  usdToBs,
  bsToUsd,
  calculateBsChangeBreakdown,
} from './exchange.service';
import { ExchangeRateType } from '../database/entities/exchange-rate.entity';
import { SecurityAuditService } from '../security/security-audit.service';

// ============================================
// INTERFACES
// ============================================

export interface SplitPaymentInput {
  method: PaymentMethod;
  amount_usd?: number;
  amount_bs?: number;
  reference?: string;
  bank_code?: string;
  phone?: string;
  card_last_4?: string;
  authorization_code?: string;
  note?: string;
}

export interface ProcessPaymentsResult {
  payments: SalePayment[];
  change?: SaleChange;
  totals: {
    total_paid_usd: number;
    total_paid_bs: number;
    total_due_usd: number;
    change_usd: number;
    change_bs: number;
    is_complete: boolean;
    is_overpaid: boolean;
  };
}

// ============================================
// SERVICIO
// ============================================

@Injectable()
export class SalePaymentsService {
  private readonly logger = new Logger(SalePaymentsService.name);
  private readonly validPaymentMethods = new Set<PaymentMethod>([
    'CASH_USD',
    'CASH_BS',
    'PAGO_MOVIL',
    'TRANSFER',
    'POINT_OF_SALE',
    'ZELLE',
    'OTHER',
    'FIAO',
  ]);

  constructor(
    @InjectRepository(SalePayment)
    private salePaymentRepository: Repository<SalePayment>,
    @InjectRepository(SaleChange)
    private saleChangeRepository: Repository<SaleChange>,
    private exchangeService: ExchangeService,
    private dataSource: DataSource,
    private securityAuditService: SecurityAuditService,
  ) {}

  /**
   * Procesa múltiples pagos para una venta
   * Calcula conversiones, cambio y guarda todo en transacción
   */
  async processPayments(
    saleId: string,
    storeId: string,
    totalDueUsd: number,
    payments: SplitPaymentInput[],
    userId?: string,
  ): Promise<ProcessPaymentsResult> {
    const references = payments
      .filter(
        (payment) =>
          payment.method === 'PAGO_MOVIL' || payment.method === 'TRANSFER',
      )
      .map((payment) => payment.reference)
      .filter((reference): reference is string => Boolean(reference));

    if (references.length !== new Set(references).size) {
      throw new BadRequestException(
        'Las referencias de pago deben ser únicas.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedPayments: SalePayment[] = [];
      let totalPaidUsd = 0;
      let totalPaidBs = 0;
      let paymentOrder = 1;

      // Procesar cada pago
      for (const paymentInput of payments) {
        if (!this.validPaymentMethods.has(paymentInput.method)) {
          throw new BadRequestException(
            `Método de pago inválido: ${paymentInput.method}`,
          );
        }

        // Obtener la tasa apropiada para este método de pago
        const rateInfo = await this.exchangeService.getRateForPaymentMethod(
          storeId,
          paymentInput.method,
        );

        if (!rateInfo) {
          throw new BadRequestException(
            `No se pudo obtener tasa para ${paymentInput.method}`,
          );
        }

        const { rate, rateType } = rateInfo;

        // Calcular montos en ambas monedas
        let amountUsd: number;
        let amountBs: number;

        if (paymentInput.amount_usd !== undefined) {
          amountUsd = paymentInput.amount_usd;
          amountBs = usdToBs(amountUsd, rate);
        } else if (paymentInput.amount_bs !== undefined) {
          amountBs = paymentInput.amount_bs;
          amountUsd = bsToUsd(amountBs, rate);
        } else {
          throw new BadRequestException(
            'Debe especificar amount_usd o amount_bs',
          );
        }

        if (amountUsd <= 0 && amountBs <= 0) {
          throw new BadRequestException(
            'Los montos de pago deben ser mayores a 0',
          );
        }

        // Crear el pago
        const payment = queryRunner.manager.create(SalePayment, {
          sale_id: saleId,
          payment_order: paymentOrder++,
          method: paymentInput.method,
          amount_cents_usd: toCents(amountUsd),
          amount_cents_bs: toCents(amountBs),
          rate_type: rateType,
          applied_rate: rate,
          reference: paymentInput.reference || null,
          bank_code: paymentInput.bank_code || null,
          phone: paymentInput.phone || null,
          card_last_4: paymentInput.card_last_4 || null,
          authorization_code: paymentInput.authorization_code || null,
          status: 'CONFIRMED' as PaymentStatus,
          confirmed_at: new Date(),
          confirmed_by: userId || null,
          note: paymentInput.note || null,
        });

        const saved = await queryRunner.manager.save(payment);
        savedPayments.push(saved);

        totalPaidUsd += amountUsd;
        totalPaidBs += amountBs;
      }

      const tolerance = 0.01;
      const difference = Math.abs(totalPaidUsd - totalDueUsd);
      if (difference > tolerance) {
        await this.securityAuditService.log({
          event_type: 'payment_mismatch',
          store_id: storeId,
          user_id: userId,
          status: 'failure',
          details: {
            sale_id: saleId,
            total_due_usd: totalDueUsd,
            total_paid_usd: totalPaidUsd,
            difference_usd: difference,
          },
        });
        throw new BadRequestException(
          `Los pagos no coinciden con el total. Total esperado: $${totalDueUsd.toFixed(2)}, Total pagado: $${totalPaidUsd.toFixed(2)}, Diferencia: $${difference.toFixed(2)}`,
        );
      }

      // Calcular si hay cambio
      const changeUsd = totalPaidUsd - totalDueUsd;
      let savedChange: SaleChange | undefined;

      if (changeUsd > 0.001) {
        // Hay sobrepago, calcular cambio
        const config = await this.exchangeService.getStoreRateConfig(storeId);
        const bcvRate = (await this.exchangeService.getBCVRate(storeId))?.rate || 36;

        // Determinar en qué moneda dar el cambio
        let changeMethod: ChangeMethod = 'CASH_BS';
        let changeCentsUsd = 0;
        let changeCentsBs = 0;
        let breakdown: ChangeBreakdown | null = null;
        let excessCentsBs = 0;
        let excessAction: ExcessAction = 'FAVOR_CUSTOMER';

        if (config.prefer_change_in === 'USD') {
          changeMethod = 'CASH_USD';
          changeCentsUsd = toCents(changeUsd);
        } else {
          // Dar cambio en Bs
          changeMethod = 'CASH_BS';
          const changeBs = usdToBs(changeUsd, bcvRate);
          changeCentsBs = toCents(changeBs);

          // Calcular desglose de billetes
          breakdown = calculateBsChangeBreakdown(changeBs);
          excessCentsBs = breakdown.excess_cents;
        }

        const change = queryRunner.manager.create(SaleChange, {
          sale_id: saleId,
          change_cents_usd: changeCentsUsd,
          change_cents_bs: changeCentsBs,
          change_method: changeMethod,
          applied_rate: bcvRate,
          breakdown: breakdown,
          excess_cents_bs: excessCentsBs,
          excess_action: excessAction,
        });

        savedChange = await queryRunner.manager.save(change);
      }

      await queryRunner.commitTransaction();

      return {
        payments: savedPayments,
        change: savedChange,
        totals: {
          total_paid_usd: totalPaidUsd,
          total_paid_bs: totalPaidBs,
          total_due_usd: totalDueUsd,
          change_usd: changeUsd > 0 ? changeUsd : 0,
          change_bs: savedChange ? fromCents(Number(savedChange.change_cents_bs)) : 0,
          is_complete: totalPaidUsd >= totalDueUsd,
          is_overpaid: changeUsd > 0.001,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error al procesar pagos', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene los pagos de una venta
   */
  async getPaymentsBySaleId(saleId: string): Promise<SalePayment[]> {
    return this.salePaymentRepository.find({
      where: { sale_id: saleId },
      order: { payment_order: 'ASC' },
    });
  }

  /**
   * Obtiene el cambio de una venta
   */
  async getChangeBySaleId(saleId: string): Promise<SaleChange | null> {
    return this.saleChangeRepository.findOne({
      where: { sale_id: saleId },
    });
  }

  /**
   * Calcula el total pagado y pendiente de una venta
   */
  async calculateSaleTotals(
    saleId: string,
    totalDueUsd: number,
  ): Promise<{
    total_paid_usd: number;
    total_paid_bs: number;
    remaining_usd: number;
    is_complete: boolean;
    is_overpaid: boolean;
  }> {
    const payments = await this.getPaymentsBySaleId(saleId);

    const totalPaidUsd = payments.reduce(
      (sum, p) => sum + fromCents(Number(p.amount_cents_usd)),
      0,
    );
    const totalPaidBs = payments.reduce(
      (sum, p) => sum + fromCents(Number(p.amount_cents_bs)),
      0,
    );

    const remainingUsd = totalDueUsd - totalPaidUsd;

    return {
      total_paid_usd: totalPaidUsd,
      total_paid_bs: totalPaidBs,
      remaining_usd: Math.max(0, remainingUsd),
      is_complete: remainingUsd <= 0.001,
      is_overpaid: remainingUsd < -0.001,
    };
  }

  /**
   * Agrega un pago adicional a una venta existente
   */
  async addPayment(
    saleId: string,
    storeId: string,
    payment: SplitPaymentInput,
    userId?: string,
  ): Promise<SalePayment> {
    // Obtener el orden del siguiente pago
    const existingPayments = await this.getPaymentsBySaleId(saleId);
    const nextOrder = existingPayments.length + 1;

    // Obtener tasa
    const rateInfo = await this.exchangeService.getRateForPaymentMethod(
      storeId,
      payment.method,
    );

    if (!rateInfo) {
      throw new BadRequestException(
        `No se pudo obtener tasa para ${payment.method}`,
      );
    }

    const { rate, rateType } = rateInfo;

    // Calcular montos
    let amountUsd: number;
    let amountBs: number;

    if (payment.amount_usd !== undefined) {
      amountUsd = payment.amount_usd;
      amountBs = usdToBs(amountUsd, rate);
    } else if (payment.amount_bs !== undefined) {
      amountBs = payment.amount_bs;
      amountUsd = bsToUsd(amountBs, rate);
    } else {
      throw new BadRequestException('Debe especificar amount_usd o amount_bs');
    }

    const newPayment = this.salePaymentRepository.create({
      sale_id: saleId,
      payment_order: nextOrder,
      method: payment.method,
      amount_cents_usd: toCents(amountUsd),
      amount_cents_bs: toCents(amountBs),
      rate_type: rateType,
      applied_rate: rate,
      reference: payment.reference || null,
      bank_code: payment.bank_code || null,
      phone: payment.phone || null,
      card_last_4: payment.card_last_4 || null,
      authorization_code: payment.authorization_code || null,
      status: 'CONFIRMED' as PaymentStatus,
      confirmed_at: new Date(),
      confirmed_by: userId || null,
      note: payment.note || null,
    });

    return this.salePaymentRepository.save(newPayment);
  }

  /**
   * Cancela/rechaza un pago
   */
  async rejectPayment(
    paymentId: string,
    reason?: string,
  ): Promise<SalePayment> {
    const payment = await this.salePaymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Pago no encontrado');
    }

    payment.status = 'REJECTED';
    payment.note = reason || payment.note;

    return this.salePaymentRepository.save(payment);
  }
}
