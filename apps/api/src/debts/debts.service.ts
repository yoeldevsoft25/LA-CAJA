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
import { AccountingService } from '../accounting/accounting.service';
import { WhatsAppMessagingService } from '../whatsapp/whatsapp-messaging.service';
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
    private accountingService: AccountingService,
    private whatsappMessagingService: WhatsAppMessagingService,
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

    const savedDebt = await this.debtRepository.save(debt);

    // Enviar notificación de WhatsApp si está habilitado (offline-first)
    try {
      await this.whatsappMessagingService.sendDebtNotification(storeId, savedDebt.id);
    } catch (error) {
      // No fallar la creación de deuda si hay error en WhatsApp
      this.logger.warn(`Error enviando notificación de WhatsApp para deuda ${savedDebt.id}:`, error);
    }

    return savedDebt;
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

        const result = { debt: updatedDebt, payment: savedPayment };

        // Generar asiento contable automático (fuera de la transacción)
        setImmediate(async () => {
          try {
            await this.accountingService.generateEntryFromDebtPayment(
              storeId,
              {
                id: updatedDebt.id,
                sale_id: updatedDebt.sale_id,
                customer_id: updatedDebt.customer_id,
              },
              {
                id: savedPayment.id,
                paid_at: savedPayment.paid_at,
                amount_bs: Number(savedPayment.amount_bs),
                amount_usd: Number(savedPayment.amount_usd),
                method: savedPayment.method,
              },
            );
          } catch (error) {
            this.logger.error(
              `Error generando asiento contable para pago de deuda ${savedPayment.id}`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        });

        return result;
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

    // Excluir deudas asociadas a ventas anuladas
    query
      .leftJoin('debt.sale', 'sale')
      .andWhere('(sale.id IS NULL OR sale.voided_at IS NULL)');

    query
      .orderBy('debt.created_at', 'DESC')
      .leftJoinAndSelect('debt.payments', 'payments')
      .leftJoinAndSelect('debt.sale', 'sale');

    return query.getMany();
  }

  async getDebtSummary(storeId: string, customerId: string): Promise<any> {
    // Excluir deudas asociadas a ventas anuladas
    const debts = await this.debtRepository
      .createQueryBuilder('debt')
      .leftJoinAndSelect('debt.payments', 'payments')
      .leftJoinAndSelect('debt.sale', 'sale')
      .where('debt.store_id = :storeId', { storeId })
      .andWhere('debt.customer_id = :customerId', { customerId })
      .andWhere('(sale.id IS NULL OR sale.voided_at IS NULL)')
      .getMany();

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
    // ⚠️ CRÍTICO: Antes de listar deudas, crear las faltantes para ventas FIAO sin deuda
    // Esto asegura que todas las ventas FIAO tengan su deuda asociada
    await this.createMissingDebtsForFIAOSales(storeId);

    const query = this.debtRepository
      .createQueryBuilder('debt')
      .where('debt.store_id = :storeId', { storeId });

    if (status) {
      query.andWhere('debt.status = :status', { status });
    }

    // Excluir deudas asociadas a ventas anuladas
    query
      .leftJoin('debt.sale', 'sale')
      .andWhere('(sale.id IS NULL OR sale.voided_at IS NULL)');

    query
      .orderBy('debt.created_at', 'DESC')
      .leftJoinAndSelect('debt.customer', 'customer')
      .leftJoinAndSelect('debt.payments', 'payments')
      .leftJoinAndSelect('debt.sale', 'sale');

    return query.getMany();
  }

  /**
   * Crea deudas faltantes para ventas FIAO que no tienen deuda asociada
   * Esto es crítico para mantener la integridad del sistema
   */
  private async createMissingDebtsForFIAOSales(storeId: string): Promise<void> {
    try {
      // Buscar ventas FIAO sin deuda asociada (excluyendo ventas anuladas)
      const fiaoSalesWithoutDebt = await this.dataSource.query(
        `
        SELECT s.id, s.store_id, s.customer_id, s.sold_at, s.totals, s.payment
        FROM sales s
        LEFT JOIN debts d ON d.sale_id = s.id AND d.store_id = s.store_id
        WHERE s.store_id = $1
          AND s.payment->>'method' = 'FIAO'
          AND s.customer_id IS NOT NULL
          AND s.voided_at IS NULL
          AND d.id IS NULL
        ORDER BY s.sold_at DESC
        LIMIT 100
        `,
        [storeId],
      );

      if (fiaoSalesWithoutDebt.length === 0) {
        return; // No hay ventas FIAO sin deuda
      }

      this.logger.log(
        `Encontradas ${fiaoSalesWithoutDebt.length} ventas FIAO sin deuda. Creando deudas faltantes...`,
      );

      for (const sale of fiaoSalesWithoutDebt) {
        try {
          const totals = typeof sale.totals === 'string' ? JSON.parse(sale.totals) : sale.totals;
          const totalUsd = Number(totals?.total_usd || 0);
          const totalBs = Number(totals?.total_bs || 0);

          if (totalUsd <= 0 && totalBs <= 0) {
            this.logger.warn(
              `Venta FIAO ${sale.id} tiene totales inválidos. Saltando creación de deuda.`,
            );
            continue;
          }

          // Verificar que el cliente existe
          const customer = await this.customerRepository.findOne({
            where: { id: sale.customer_id, store_id: storeId },
          });

          if (!customer) {
            this.logger.warn(
              `Cliente ${sale.customer_id} no encontrado para venta FIAO ${sale.id}. Saltando creación de deuda.`,
            );
            continue;
          }

          // Crear la deuda
          const debt = this.debtRepository.create({
            id: randomUUID(),
            store_id: storeId,
            sale_id: sale.id,
            customer_id: sale.customer_id,
            created_at: sale.sold_at,
            amount_bs: totalBs,
            amount_usd: totalUsd,
            status: DebtStatus.OPEN,
          });

          await this.debtRepository.save(debt);
          this.logger.log(
            `✅ Deuda creada para venta FIAO ${sale.id}: ${debt.id} - Cliente: ${customer.name} - Monto: $${totalUsd} USD`,
          );
        } catch (error) {
          this.logger.error(
            `Error creando deuda para venta FIAO ${sale.id}:`,
            error instanceof Error ? error.message : String(error),
          );
          // Continuar con la siguiente venta
        }
      }
    } catch (error) {
      // No fallar si hay error - solo loguear
      this.logger.error(
        `Error en createMissingDebtsForFIAOSales:`,
        error instanceof Error ? error.message : String(error),
      );
    }
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

  /**
   * Envía recordatorio de deudas pendientes a un cliente por WhatsApp
   */
  async sendDebtReminder(
    storeId: string,
    customerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.whatsappMessagingService.sendDebtReminder(storeId, customerId);
      return { success: result.queued, error: result.error };
    } catch (error: any) {
      this.logger.error(`Error enviando recordatorio de deudas:`, error);
      return { success: false, error: error.message || 'Error desconocido' };
    }
  }
}
