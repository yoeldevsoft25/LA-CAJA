import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Debt, DebtStatus } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { Customer } from '../database/entities/customer.entity';
import { Sale } from '../database/entities/sale.entity';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
import { ExchangeService } from '../exchange/exchange.service';
import { randomUUID } from 'crypto';

@Injectable()
export class DebtsService {
  private readonly logger = new Logger(DebtsService.name);

  constructor(
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(DebtPayment)
    private debtPaymentRepository: Repository<DebtPayment>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    private dataSource: DataSource,
    private exchangeService: ExchangeService,
  ) {}

  async createDebtFromSale(
    storeId: string,
    saleId: string,
    customerId: string,
  ): Promise<Debt> {
    // Verificar que la venta existe y es tipo FIAO
    const sale = await this.saleRepository.findOne({
      where: { id: saleId, store_id: storeId },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    const payment = sale.payment as any;
    if (payment.method !== 'FIAO') {
      throw new BadRequestException('La venta no es tipo FIAO');
    }

    // Verificar que el cliente existe
    const customer = await this.customerRepository.findOne({
      where: { id: customerId, store_id: storeId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Crear la deuda
    const debt = this.debtRepository.create({
      id: randomUUID(),
      store_id: storeId,
      sale_id: saleId,
      customer_id: customerId,
      created_at: sale.sold_at,
      amount_bs: sale.totals.total_bs,
      amount_usd: sale.totals.total_usd,
      status: DebtStatus.OPEN,
    });

    return this.debtRepository.save(debt);
  }

  async addPayment(
    storeId: string,
    debtId: string,
    dto: CreateDebtPaymentDto,
  ): Promise<{ debt: Debt; payment: DebtPayment }> {
    this.logger.log(
      `addPayment - storeId: ${storeId}, debtId: ${debtId}, dto: ${JSON.stringify(dto)}`,
    );
    try {
      return await this.dataSource.transaction(async (manager) => {
        // NO cargar relaciones aquí para evitar que TypeORM intente sincronizarlas
        const debt = await manager.findOne(Debt, {
          where: { id: debtId, store_id: storeId },
        });

        if (!debt) {
          throw new NotFoundException('Deuda no encontrada');
        }

        if (debt.status === DebtStatus.PAID) {
          throw new BadRequestException(
            'La deuda ya está pagada completamente',
          );
        }

        // Obtener tasa BCV actual para calcular el equivalente en Bs
        let exchangeRate = 36; // Fallback por defecto
        try {
          const bcvRateData = await this.exchangeService.getBCVRate();
          if (bcvRateData && bcvRateData.rate && bcvRateData.rate > 0) {
            exchangeRate = bcvRateData.rate;
          }
        } catch (error) {
          // Si falla obtener la tasa, usar el fallback
          // No lanzar error, solo usar el valor por defecto
        }

        // Asegurar que el monto USD sea un número válido y redondear a 2 decimales
        let paymentAmountUsd = Number(dto.amount_usd) || 0;
        if (isNaN(paymentAmountUsd) || paymentAmountUsd <= 0) {
          throw new BadRequestException(
            'El monto en USD debe ser mayor a cero',
          );
        }
        paymentAmountUsd = Math.round(paymentAmountUsd * 100) / 100;

        // Calcular el equivalente en Bs usando la tasa BCV actual y redondear a 2 decimales
        // IGNORAR el amount_bs que viene del frontend, recalcularlo aquí
        let paymentAmountBs = paymentAmountUsd * exchangeRate;
        paymentAmountBs = Math.round(paymentAmountBs * 100) / 100;

        const debtAmountUsd = Number(debt.amount_usd) || 0;

        // Obtener pagos existentes directamente sin usar la relación
        const existingPayments = await manager.find(DebtPayment, {
          where: { debt_id: debtId },
        });

        // Calcular total pagado antes de este pago (redondeado)
        Math.round(
          existingPayments.reduce(
            (sum, p) => sum + Number(p.amount_bs || 0),
            0,
          ) * 100,
        ) / 100;
        const previousPaidUsd =
          Math.round(
            existingPayments.reduce(
              (sum, p) => sum + Number(p.amount_usd || 0),
              0,
            ) * 100,
          ) / 100;

        // Calcular total pagado después de este pago
        const totalPaidUsd =
          Math.round((previousPaidUsd + paymentAmountUsd) * 100) / 100;

        // IMPORTANTE: Solo validar por USD (moneda de referencia)
        // El equivalente en Bs puede variar según la tasa BCV actual vs la tasa original
        // La tasa puede subir o bajar, por lo que el equivalente en Bs puede ser diferente
        const tolerance = 0.01;
        if (totalPaidUsd > debtAmountUsd + tolerance) {
          throw new BadRequestException(
            `El pago excede el monto de la deuda. Monto adeudado: ${debtAmountUsd.toFixed(2)} USD. Ya pagado: ${previousPaidUsd.toFixed(2)} USD. Intenta pagar: ${paymentAmountUsd.toFixed(2)} USD`,
          );
        }

        // Validar que los valores sean válidos antes de crear el pago
        if (!paymentAmountUsd || paymentAmountUsd <= 0) {
          throw new BadRequestException(
            'El monto en USD debe ser mayor a cero',
          );
        }
        if (!paymentAmountBs || paymentAmountBs < 0) {
          throw new BadRequestException(
            'Error al calcular el equivalente en Bs',
          );
        }
        if (!dto.method) {
          throw new BadRequestException('El método de pago es requerido');
        }

        // Crear el pago usando QueryBuilder para evitar problemas con relaciones
        const paymentRepository = manager.getRepository(DebtPayment);

        const paymentId = randomUUID();
        const paidAt = new Date();

        // Validar que debt_id no sea null antes de guardar
        if (!debtId || !storeId) {
          this.logger.error(`Error: debt_id=${debtId}, store_id=${storeId}`);
          throw new BadRequestException(
            'Error al crear el pago: datos inválidos',
          );
        }

        // Validar una vez más antes de insertar
        if (
          !debtId ||
          debtId.trim() === '' ||
          debtId === 'null' ||
          debtId === 'undefined'
        ) {
          this.logger.error(
            `Error crítico: debtId inválido antes de insertar. debtId="${debtId}", tipo=${typeof debtId}, storeId=${storeId}`,
          );
          throw new BadRequestException(
            `Error al crear el pago: debt_id inválido (${debtId})`,
          );
        }

        if (
          !storeId ||
          storeId.trim() === '' ||
          storeId === 'null' ||
          storeId === 'undefined'
        ) {
          this.logger.error(
            `Error crítico: storeId inválido antes de insertar. storeId="${storeId}", tipo=${typeof storeId}, debtId=${debtId}`,
          );
          throw new BadRequestException(
            `Error al crear el pago: store_id inválido (${storeId})`,
          );
        }

        this.logger.log(
          `Insertando pago - paymentId: ${paymentId}, storeId: ${storeId}, debtId: ${debtId}, amount_usd: ${paymentAmountUsd}, amount_bs: ${paymentAmountBs}`,
        );

        // Preparar valores para el insert
        this.logger.log(
          `Valores a insertar - paymentId: ${paymentId}, storeId: ${storeId}, debtId: ${debtId}, paidAt: ${paidAt}, amount_usd: ${paymentAmountUsd}, amount_bs: ${paymentAmountBs}, method: ${dto.method}`,
        );

        // Usar SQL directo para evitar problemas con relaciones TypeORM
        await manager.query(
          `INSERT INTO debt_payments (id, store_id, debt_id, paid_at, amount_bs, amount_usd, method, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            paymentId,
            storeId,
            debtId,
            paidAt,
            paymentAmountBs,
            paymentAmountUsd,
            dto.method,
            dto.note || null,
          ],
        );

        this.logger.log(`Insert completado usando SQL directo`);

        // Recargar el pago insertado
        const savedPayment = await paymentRepository.findOne({
          where: { id: paymentId },
        });

        if (!savedPayment) {
          throw new BadRequestException('Error al guardar el pago');
        }

        // Actualizar estado de la deuda (solo considerar USD como moneda de referencia)
        // El equivalente en Bs puede variar con la tasa, pero USD es la referencia
        const isFullyPaid = totalPaidUsd >= debtAmountUsd;
        const hasPartialPayment = totalPaidUsd > 0;

        let newStatus: DebtStatus = debt.status;
        if (isFullyPaid) {
          newStatus = DebtStatus.PAID;
        } else if (hasPartialPayment && debt.status === DebtStatus.OPEN) {
          newStatus = DebtStatus.PARTIAL;
        }

        // Actualizar solo el status usando QueryBuilder para evitar problemas con relaciones
        if (newStatus !== debt.status) {
          await manager
            .createQueryBuilder()
            .update(Debt)
            .set({ status: newStatus })
            .where('id = :debtId', { debtId })
            .execute();
        }

        // Recargar la deuda con todos los pagos actualizados
        const updatedDebt = await manager.findOne(Debt, {
          where: { id: debtId },
          relations: ['payments'],
        });

        if (!updatedDebt) {
          throw new NotFoundException('Error al actualizar la deuda');
        }

        return { debt: updatedDebt, payment: savedPayment };
      });
    } catch (error) {
      this.logger.error(`Error al agregar pago a deuda ${debtId}:`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al registrar el pago: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
    }
  }

  async getDebtsByCustomer(
    storeId: string,
    customerId: string,
    includePaid: boolean = false,
  ): Promise<Debt[]> {
    const query = this.debtRepository
      .createQueryBuilder('debt')
      .where('debt.store_id = :storeId', { storeId })
      .andWhere('debt.customer_id = :customerId', { customerId });

    if (!includePaid) {
      query.andWhere('debt.status = :status', { status: DebtStatus.OPEN });
    }

    query
      .orderBy('debt.created_at', 'DESC')
      .leftJoinAndSelect('debt.payments', 'payments')
      .leftJoinAndSelect('debt.sale', 'sale');

    return query.getMany();
  }

  async getDebtSummary(storeId: string, customerId: string): Promise<any> {
    const debts = await this.debtRepository.find({
      where: { store_id: storeId, customer_id: customerId },
      relations: ['payments', 'sale'],
    });

    let totalDebtBs = 0;
    let totalDebtUsd = 0;
    let totalPaidBs = 0;
    let totalPaidUsd = 0;
    let openDebts = 0;

    for (const debt of debts) {
      const debtAmountBs = Number(debt.amount_bs);
      const debtAmountUsd = Number(debt.amount_usd);

      totalDebtBs += debtAmountBs;
      totalDebtUsd += debtAmountUsd;

      const paidBs = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_bs),
        0,
      );
      const paidUsd = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_usd),
        0,
      );

      totalPaidBs += paidBs;
      totalPaidUsd += paidUsd;

      if (debt.status === DebtStatus.OPEN) {
        openDebts++;
      }
    }

    return {
      total_debt_bs: totalDebtBs,
      total_debt_usd: totalDebtUsd,
      total_paid_bs: totalPaidBs,
      total_paid_usd: totalPaidUsd,
      remaining_bs: totalDebtBs - totalPaidBs,
      remaining_usd: totalDebtUsd - totalPaidUsd,
      open_debts_count: openDebts,
      total_debts_count: debts.length,
    };
  }

  async findAll(storeId: string, status?: DebtStatus): Promise<Debt[]> {
    const query = this.debtRepository
      .createQueryBuilder('debt')
      .where('debt.store_id = :storeId', { storeId });

    if (status) {
      query.andWhere('debt.status = :status', { status });
    }

    query
      .orderBy('debt.created_at', 'DESC')
      .leftJoinAndSelect('debt.customer', 'customer')
      .leftJoinAndSelect('debt.payments', 'payments');

    return query.getMany();
  }

  async findOne(storeId: string, debtId: string): Promise<Debt> {
    const debt = await this.debtRepository.findOne({
      where: { id: debtId, store_id: storeId },
      relations: ['customer', 'sale', 'payments'],
    });

    if (!debt) {
      throw new NotFoundException('Deuda no encontrada');
    }

    return debt;
  }
}
