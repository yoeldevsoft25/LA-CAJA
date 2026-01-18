import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  LicensePayment,
  LicensePaymentStatus,
  LicensePlan,
  BillingPeriod,
} from '../database/entities/license-payment.entity';
import { Store } from '../database/entities/store.entity';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';

// Precios de los planes (USD)
const PLAN_PRICES: Record<
  LicensePlan,
  { monthly: number; yearly: number }
> = {
  [LicensePlan.FREEMIUM]: { monthly: 0, yearly: 0 },
  [LicensePlan.BASICO]: { monthly: 29, yearly: 290 },
  [LicensePlan.PROFESIONAL]: { monthly: 79, yearly: 790 },
  [LicensePlan.EMPRESARIAL]: { monthly: 199, yearly: 1990 },
};

@Injectable()
export class LicensePaymentsService {
  private readonly logger = new Logger(LicensePaymentsService.name);

  constructor(
    @InjectRepository(LicensePayment)
    private readonly paymentRepo: Repository<LicensePayment>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Calcula el monto esperado según el plan y período
   */
  calculateExpectedAmount(
    plan: LicensePlan,
    billingPeriod: BillingPeriod,
  ): number {
    const prices = PLAN_PRICES[plan];
    if (!prices) {
      throw new BadRequestException(`Plan inválido: ${plan}`);
    }

    return billingPeriod === BillingPeriod.MONTHLY
      ? prices.monthly
      : prices.yearly;
  }

  /**
   * Crea una nueva solicitud de pago
   */
  async createPaymentRequest(
    storeId: string,
    userId: string,
    dto: CreatePaymentRequestDto,
  ): Promise<LicensePayment> {
    // Verificar que la tienda existe
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Tienda no encontrada');
    }

    // Validar que el plan y período sean válidos
    if (dto.plan === LicensePlan.FREEMIUM) {
      throw new BadRequestException(
        'No se puede solicitar pago para el plan Freemium',
      );
    }

    // Calcular monto esperado
    const expectedAmount = this.calculateExpectedAmount(
      dto.plan,
      dto.billing_period,
    );

    // Validar que el monto sea correcto (con tolerancia de 0.01 USD)
    if (Math.abs(dto.amount_usd - expectedAmount) > 0.01) {
      throw new BadRequestException(
        `El monto debe ser ${expectedAmount} USD para el plan ${dto.plan} (${dto.billing_period})`,
      );
    }

    // Verificar límite de solicitudes por día
    const maxRequestsPerDay =
      this.configService.get<number>('LICENSE_MAX_PAYMENT_REQUESTS_PER_DAY') ||
      5;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const requestsToday = await this.paymentRepo.count({
      where: {
        store_id: storeId,
        created_at: Between(today, tomorrow),
        status: LicensePaymentStatus.PENDING,
      },
    });

    if (requestsToday >= maxRequestsPerDay) {
      throw new BadRequestException(
        `Se alcanzó el límite de solicitudes por día (${maxRequestsPerDay})`,
      );
    }

    // Calcular fecha de expiración
    const expiryDays =
      this.configService.get<number>('LICENSE_PAYMENT_EXPIRY_DAYS') || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Crear la solicitud
    const payment = this.paymentRepo.create({
      id: randomUUID(),
      store_id: storeId,
      plan: dto.plan,
      billing_period: dto.billing_period,
      amount_usd: dto.amount_usd,
      amount_bs: dto.amount_bs || null,
      exchange_rate: dto.exchange_rate || null,
      payment_method: dto.payment_method,
      payment_reference: dto.payment_reference,
      bank_code: dto.bank_code || null,
      phone_number: dto.phone_number || null,
      account_number: dto.account_number || null,
      status: LicensePaymentStatus.PENDING,
      notes: dto.notes || null,
      expires_at: expiresAt,
      verification_attempts: 0,
      auto_verified: false,
    });

    const saved = await this.paymentRepo.save(payment);
    this.logger.log(
      `Nueva solicitud de pago creada: ${saved.id} para tienda ${storeId}`,
    );

    return saved;
  }

  /**
   * Obtiene una solicitud de pago por ID
   */
  async getPaymentById(
    paymentId: string,
    storeId?: string,
  ): Promise<LicensePayment> {
    const where: any = { id: paymentId };
    if (storeId) {
      where.store_id = storeId;
    }

    const payment = await this.paymentRepo.findOne({
      where,
      relations: ['documents', 'verifications', 'store'],
    });

    if (!payment) {
      throw new NotFoundException('Solicitud de pago no encontrada');
    }

    return payment;
  }

  /**
   * Lista solicitudes de pago (admin o usuario)
   */
  async listPayments(
    storeId?: string,
    status?: LicensePaymentStatus,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ payments: LicensePayment[]; total: number }> {
    const where: any = {};
    if (storeId) {
      where.store_id = storeId;
    }
    if (status) {
      where.status = status;
    }

    const [payments, total] = await this.paymentRepo.findAndCount({
      where,
      relations: ['store', 'documents'],
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { payments, total };
  }

  /**
   * Aprueba un pago y activa la licencia
   */
  async approvePayment(
    paymentId: string,
    approvedBy: string,
    notes?: string,
  ): Promise<{ payment: LicensePayment; store: Store }> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['store'],
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (payment.status !== LicensePaymentStatus.VERIFIED) {
      throw new BadRequestException(
        'Solo se pueden aprobar pagos verificados',
      );
    }

    const store = payment.store;
    if (!store) {
      throw new NotFoundException('Tienda no encontrada');
    }

    // Calcular fecha de expiración de la licencia
    const now = new Date();
    let expiresAt: Date;

    if (payment.billing_period === BillingPeriod.MONTHLY) {
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      // Yearly: 12 meses
      expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Actualizar estado del pago
    payment.status = LicensePaymentStatus.APPROVED;
    payment.approved_at = new Date();
    payment.approved_by = approvedBy;
    if (notes) {
      payment.notes = payment.notes
        ? `${payment.notes}\n${notes}`
        : notes;
    }
    await this.paymentRepo.save(payment);

    // Activar la licencia de la tienda
    store.license_status = 'active';
    store.license_plan = payment.plan;
    store.license_expires_at = expiresAt;
    store.license_grace_days = store.license_grace_days || 3;
    if (notes) {
      store.license_notes = notes;
    }

    await this.storeRepo.save(store);

    this.logger.log(
      `Pago ${paymentId} aprobado y licencia activada para tienda ${store.id}`,
    );

    return { payment, store };
  }

  /**
   * Rechaza un pago
   */
  async rejectPayment(
    paymentId: string,
    rejectedBy: string,
    rejectionReason: string,
    notes?: string,
  ): Promise<LicensePayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    if (
      payment.status === LicensePaymentStatus.APPROVED ||
      payment.status === LicensePaymentStatus.REJECTED
    ) {
      throw new BadRequestException(
        `No se puede rechazar un pago con estado ${payment.status}`,
      );
    }

    payment.status = LicensePaymentStatus.REJECTED;
    payment.rejected_at = new Date();
    payment.rejected_by = rejectedBy;
    payment.rejection_reason = rejectionReason;
    if (notes) {
      payment.notes = payment.notes
        ? `${payment.notes}\n${notes}`
        : notes;
    }

    await this.paymentRepo.save(payment);
    this.logger.log(`Pago ${paymentId} rechazado por ${rejectedBy}`);

    return payment;
  }

  /**
   * Expira solicitudes que no fueron verificadas
   */
  async expirePendingPayments(): Promise<number> {
    const now = new Date();
    const result = await this.paymentRepo.update(
      {
        status: LicensePaymentStatus.PENDING,
        expires_at: LessThanOrEqual(now),
      },
      {
        status: LicensePaymentStatus.EXPIRED,
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `${result.affected} solicitudes de pago expiradas automáticamente`,
      );
    }

    return result.affected || 0;
  }

  /**
   * Obtiene estadísticas de pagos
   */
  async getPaymentStats(
    storeId?: string,
  ): Promise<{
    total: number;
    pending: number;
    verified: number;
    approved: number;
    rejected: number;
    expired: number;
  }> {
    const where: any = {};
    if (storeId) {
      where.store_id = storeId;
    }

    const [
      total,
      pending,
      verified,
      approved,
      rejected,
      expired,
    ] = await Promise.all([
      this.paymentRepo.count({ where }),
      this.paymentRepo.count({
        where: { ...where, status: LicensePaymentStatus.PENDING },
      }),
      this.paymentRepo.count({
        where: { ...where, status: LicensePaymentStatus.VERIFIED },
      }),
      this.paymentRepo.count({
        where: { ...where, status: LicensePaymentStatus.APPROVED },
      }),
      this.paymentRepo.count({
        where: { ...where, status: LicensePaymentStatus.REJECTED },
      }),
      this.paymentRepo.count({
        where: { ...where, status: LicensePaymentStatus.EXPIRED },
      }),
    ]);

    return {
      total,
      pending,
      verified,
      approved,
      rejected,
      expired,
    };
  }
}
