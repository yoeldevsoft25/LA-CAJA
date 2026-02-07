import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Debt, DebtStatus } from '../database/entities/debt.entity';
import { DebtPayment } from '../database/entities/debt-payment.entity';
import { Customer } from '../database/entities/customer.entity';
import { Sale } from '../database/entities/sale.entity';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
import { CreateLegacyDebtDto } from './dto/create-legacy-debt.dto';
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
  ) { }

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
      note: null,
      status: DebtStatus.OPEN,
    });

    const savedDebt = await this.debtRepository.save(debt);

    // Enviar notificación de WhatsApp si está habilitado (offline-first)
    try {
      await this.whatsappMessagingService.sendDebtNotification(
        storeId,
        savedDebt.id,
      );
    } catch (error) {
      // No fallar la creación de deuda si hay error en WhatsApp
      this.logger.warn(
        `Error enviando notificación de WhatsApp para deuda ${savedDebt.id}:`,
        error,
      );
    }

    return savedDebt;
  }

  async createLegacyDebt(
    storeId: string,
    dto: CreateLegacyDebtDto,
  ): Promise<Debt> {
    const customer = await this.customerRepository.findOne({
      where: { id: dto.customer_id, store_id: storeId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const debt = this.debtRepository.create({
      id: randomUUID(),
      store_id: storeId,
      sale_id: null,
      customer_id: dto.customer_id,
      created_at: dto.created_at ? new Date(dto.created_at) : new Date(),
      amount_bs: dto.amount_usd * 36,
      amount_usd: dto.amount_usd,
      note: dto.note ?? null,
      status: DebtStatus.OPEN,
    });

    const savedDebt = await this.debtRepository.save(debt);
    this.logger.log(
      `Legacy Debt creada: ${savedDebt.id} para cliente ${customer.name}`,
    );

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

        const remainingUsdAfterPayment =
          Math.round((debtAmountUsd - totalPaidUsd) * 100) / 100;
        const rolloverRequested = Boolean(dto.rollover_remaining);
        const shouldRollover =
          rolloverRequested && remainingUsdAfterPayment > tolerance;

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

        let rolloverDebtId: string | null = null;
        if (shouldRollover) {
          rolloverDebtId = randomUUID();
          const rolloverAmountUsd = remainingUsdAfterPayment;
          const rolloverAmountBs =
            Math.round(rolloverAmountUsd * exchangeRate * 100) / 100;

          await manager.query(
            `INSERT INTO debts (id, store_id, sale_id, customer_id, created_at, amount_bs, amount_usd, note, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              rolloverDebtId,
              storeId,
              null,
              debt.customer_id,
              paidAt,
              rolloverAmountBs,
              rolloverAmountUsd,
              `Saldo restante de deuda ${debtId}`,
              DebtStatus.OPEN,
            ],
          );

          const rolloverPaymentId = randomUUID();
          await manager.query(
            `INSERT INTO debt_payments (id, store_id, debt_id, paid_at, amount_bs, amount_usd, method, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              rolloverPaymentId,
              storeId,
              debtId,
              paidAt,
              rolloverAmountBs,
              rolloverAmountUsd,
              'ROLLOVER',
              `Saldo trasladado a nueva deuda ${rolloverDebtId}`,
            ],
          );
        }

        // Actualizar estado de la deuda (solo considerar USD como moneda de referencia)
        // El equivalente en Bs puede variar con la tasa, pero USD es la referencia
        const isFullyPaid = totalPaidUsd >= debtAmountUsd;
        const hasPartialPayment = totalPaidUsd > 0;

        let newStatus: DebtStatus = debt.status;
        if (shouldRollover) {
          newStatus = DebtStatus.PAID;
        } else if (isFullyPaid) {
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
      .leftJoinAndSelect('debt.payments', 'payments')
      .leftJoinAndSelect('debt.sale', 'sale')
      .where('debt.store_id = :storeId', { storeId })
      .andWhere('debt.customer_id = :customerId', { customerId })
      .andWhere(
        '(:includePaid = true OR debt.status = :openStatus)',
        { includePaid, openStatus: DebtStatus.OPEN }
      )
      .andWhere(
        '(debt.sale_id IS NULL OR sale.voided_at IS NULL)',
      ); // Excluir deudas de ventas anuladas usando el join ya existente

    query.orderBy('debt.created_at', 'DESC');

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
      .andWhere(
        '(debt.sale_id IS NULL OR sale.voided_at IS NULL)',
      )
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
    // Se ejecuta en segundo plano para no bloquear la respuesta
    setImmediate(() => {
      this.createMissingDebtsForFIAOSales(storeId).catch((err) => {
        this.logger.error(
          `Error en segundo plano ejecutando createMissingDebtsForFIAOSales: ${err.message}`,
        );
      });
    });

    const query = this.debtRepository
      .createQueryBuilder('debt')
      .leftJoinAndSelect('debt.customer', 'customer')
      .leftJoinAndSelect('debt.payments', 'payments')
      .leftJoinAndSelect('debt.sale', 'sale')
      .where('debt.store_id = :storeId', { storeId })
      .andWhere(
        '(debt.sale_id IS NULL OR sale.voided_at IS NULL)',
      ); // Excluir deudas de ventas anuladas

    if (status) {
      query.andWhere('debt.status = :status', { status });
    }

    query.orderBy('debt.created_at', 'DESC');

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
          const totals =
            typeof sale.totals === 'string'
              ? JSON.parse(sale.totals)
              : sale.totals;
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
      relations: [
        'customer',
        'sale',
        'sale.items',
        'sale.items.product',
        'sale.items.variant',
        'payments',
      ],
    });

    if (!debt) {
      throw new NotFoundException('Deuda no encontrada');
    }

    return debt;
  }

  /**
   * Envía recordatorio de deudas pendientes a un cliente por WhatsApp.
   * Si debtIds está definido y no está vacío, solo se incluyen esas deudas; si no, todas las pendientes.
   */
  async sendDebtReminder(
    storeId: string,
    customerId: string,
    debtIds?: string[],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (debtIds && debtIds.length === 0) {
        return {
          success: false,
          error: 'Seleccione al menos una deuda para enviar',
        };
      }
      const result = await this.whatsappMessagingService.sendDebtReminder(
        storeId,
        customerId,
        debtIds,
      );
      return { success: result.queued, error: result.error };
    } catch (error: any) {
      this.logger.error(`Error enviando recordatorio de deudas:`, error);
      return { success: false, error: error.message || 'Error desconocido' };
    }
  }

  /**
   * Paga todas las deudas pendientes de un cliente
   */
  async payAllDebts(
    storeId: string,
    customerId: string,
    dto: CreateDebtPaymentDto,
  ): Promise<{ debts: Debt[]; payments: DebtPayment[] }> {
    const requestedDebtIds = Array.isArray(dto.debt_ids)
      ? Array.from(new Set(dto.debt_ids))
      : null;

    // Obtener deudas pendientes del cliente (todas o las seleccionadas)
    const whereClause: any = {
      store_id: storeId,
      customer_id: customerId,
      status: In([DebtStatus.OPEN, DebtStatus.PARTIAL]),
    };

    if (requestedDebtIds && requestedDebtIds.length > 0) {
      whereClause.id = In(requestedDebtIds);
    }

    const debts = await this.debtRepository.find({
      where: whereClause,
      relations: ['payments'],
    });

    if (requestedDebtIds && requestedDebtIds.length > 0) {
      const foundIds = new Set(debts.map((d) => d.id));
      const missing = requestedDebtIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          'Algunas deudas seleccionadas no existen, ya están pagadas o no pertenecen a este cliente',
        );
      }
    }

    if (debts.length === 0) {
      throw new NotFoundException('No hay deudas pendientes para este cliente');
    }

    const isSelective = !!(requestedDebtIds && requestedDebtIds.length > 0);

    // Calcular el total pendiente
    let totalRemainingUsd = 0;
    let totalRemainingBs = 0;

    for (const debt of debts) {
      const totalPaidUsd = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_usd),
        0,
      );
      const totalPaidBs = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_bs),
        0,
      );
      totalRemainingUsd += Number(debt.amount_usd) - totalPaidUsd;
      totalRemainingBs += Number(debt.amount_bs) - totalPaidBs;
    }

    const paymentUsd = Number(dto.amount_usd) || 0;
    const tolerance = 0.01;

    // Validaciones de monto
    if (paymentUsd <= 0) {
      throw new BadRequestException('El monto del pago debe ser mayor a cero');
    }
    // Permitir abonos al total (pago parcial distribuido)
    // if (!isSelective && paymentUsd < totalRemainingUsd - tolerance) {
    //   throw new BadRequestException(
    //     `El monto del pago ($${paymentUsd.toFixed(2)}) es menor al total pendiente ($${totalRemainingUsd.toFixed(2)})`,
    //   );
    // }
    if (isSelective && paymentUsd > totalRemainingUsd + tolerance) {
      throw new BadRequestException(
        `El monto del pago ($${paymentUsd.toFixed(2)}) excede el total seleccionado ($${totalRemainingUsd.toFixed(2)})`,
      );
    }

    // Obtener tasa BCV actual para calcular el equivalente en Bs (solo referencia)
    let exchangeRate = 36;
    try {
      const bcvRateData = await this.exchangeService.getBCVRate();
      if (bcvRateData && bcvRateData.rate && bcvRateData.rate > 0) {
        exchangeRate = bcvRateData.rate;
      }
    } catch (error) {
      // fallback
    }

    const sortedDebts = debts.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const distribution =
      dto.distribution === 'PROPORTIONAL' ? 'PROPORTIONAL' : 'SEQUENTIAL';

    // Procesar pagos en una transacción
    const payments: DebtPayment[] = [];
    const updatedDebts: Debt[] = [];

    await this.dataSource.transaction(async (manager) => {
      const paymentRepository = manager.getRepository(DebtPayment);

      const debtBalances = sortedDebts
        .map((debt) => {
          const totalPaidUsd = (debt.payments || []).reduce(
            (sum, p) => sum + Number(p.amount_usd),
            0,
          );
          const totalPaidBs = (debt.payments || []).reduce(
            (sum, p) => sum + Number(p.amount_bs),
            0,
          );
          const remainingUsd = Number(debt.amount_usd) - totalPaidUsd;
          const remainingBs = Number(debt.amount_bs) - totalPaidBs;
          return {
            debt,
            remainingUsd,
            remainingBs,
          };
        })
        .filter((entry) => entry.remainingUsd > tolerance);

      const useProportional =
        isSelective &&
        distribution === 'PROPORTIONAL' &&
        paymentUsd < totalRemainingUsd - tolerance;

      if (useProportional) {
        const paymentCents = Math.round(paymentUsd * 100);
        const totalRemainingCents = Math.round(totalRemainingUsd * 100);
        const allocations = debtBalances.map((entry) =>
          Math.floor(
            (paymentCents * Math.round(entry.remainingUsd * 100)) /
            totalRemainingCents,
          ),
        );

        const allocated = allocations.reduce((sum, v) => sum + v, 0);
        let remainder = paymentCents - allocated;
        let guard = 0;
        while (remainder > 0 && guard < 1000) {
          let progressed = false;
          for (let i = 0; i < debtBalances.length && remainder > 0; i += 1) {
            const capacity =
              Math.round(debtBalances[i].remainingUsd * 100) - allocations[i];
            if (capacity > 0) {
              allocations[i] += 1;
              remainder -= 1;
              progressed = true;
            }
          }
          if (!progressed) break;
          guard += 1;
        }

        for (let i = 0; i < debtBalances.length; i += 1) {
          const entry = debtBalances[i];
          const allocCents = allocations[i];
          if (allocCents <= 0) continue;

          const payUsd = Math.round(allocCents) / 100;
          const isFullForDebt = payUsd >= entry.remainingUsd - tolerance;
          const payBs = isFullForDebt
            ? Math.round(entry.remainingBs * 100) / 100
            : Math.round(payUsd * exchangeRate * 100) / 100;

          const paymentId = randomUUID();
          const paidAt = new Date();

          await manager.query(
            `INSERT INTO debt_payments (id, store_id, debt_id, paid_at, amount_bs, amount_usd, method, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              paymentId,
              storeId,
              entry.debt.id,
              paidAt,
              payBs,
              payUsd,
              dto.method,
              dto.note || 'Pago de deudas seleccionadas (proporcional)',
            ],
          );

          const willBePaid = isFullForDebt;
          const newStatus = willBePaid ? DebtStatus.PAID : DebtStatus.PARTIAL;
          await manager
            .createQueryBuilder()
            .update(Debt)
            .set({ status: newStatus })
            .where('id = :debtId', { debtId: entry.debt.id })
            .execute();

          const updatedDebt = await manager.findOne(Debt, {
            where: { id: entry.debt.id },
            relations: ['payments'],
          });

          const payment = await paymentRepository.findOne({
            where: { id: paymentId },
          });

          if (updatedDebt && payment) {
            updatedDebts.push(updatedDebt);
            payments.push(payment);
          }
        }
      } else {
        let remainingToPayUsd = Math.round(paymentUsd * 100) / 100;

        for (const entry of debtBalances) {
          if (remainingToPayUsd <= tolerance) break;

          const payUsd = Math.min(entry.remainingUsd, remainingToPayUsd);
          if (payUsd <= 0) continue;

          const isFullForDebt = payUsd >= entry.remainingUsd - tolerance;
          const payBs = isFullForDebt
            ? Math.round(entry.remainingBs * 100) / 100
            : Math.round(payUsd * exchangeRate * 100) / 100;

          const paymentId = randomUUID();
          const paidAt = new Date();

          await manager.query(
            `INSERT INTO debt_payments (id, store_id, debt_id, paid_at, amount_bs, amount_usd, method, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              paymentId,
              storeId,
              entry.debt.id,
              paidAt,
              payBs,
              payUsd,
              dto.method,
              dto.note ||
              (isSelective
                ? 'Pago de deudas seleccionadas'
                : 'Pago completo de todas las deudas'),
            ],
          );

          const willBePaid = isFullForDebt;
          const newStatus = willBePaid ? DebtStatus.PAID : DebtStatus.PARTIAL;
          await manager
            .createQueryBuilder()
            .update(Debt)
            .set({ status: newStatus })
            .where('id = :debtId', { debtId: entry.debt.id })
            .execute();

          const updatedDebt = await manager.findOne(Debt, {
            where: { id: entry.debt.id },
            relations: ['payments'],
          });

          const payment = await paymentRepository.findOne({
            where: { id: paymentId },
          });

          if (updatedDebt && payment) {
            updatedDebts.push(updatedDebt);
            payments.push(payment);
          }

          remainingToPayUsd =
            Math.round((remainingToPayUsd - payUsd) * 100) / 100;

          // LOGICA DE CORTE: Si la deuda no fue pagada totalmente (es parcial) y ya no hay más dinero para pagar
          // entonces debemos hacer el "rollover" (traslado) del saldo restante a una nueva deuda
          // y marcar la deuda actual como PAGADA.
          if (!isFullForDebt && remainingToPayUsd <= tolerance) {
            const remainingDebtUsd =
              Math.round((entry.remainingUsd - payUsd) * 100) / 100;
            const remainingDebtBs =
              Math.round((entry.remainingBs - payBs) * 100) / 100;

            if (remainingDebtUsd > tolerance) {
              const rolloverDebtId = randomUUID();

              // 1. Crear la nueva deuda con el saldo restante
              await manager.query(
                `INSERT INTO debts (id, store_id, sale_id, customer_id, created_at, amount_bs, amount_usd, note, status, parent_debt_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                  rolloverDebtId,
                  storeId,
                  null, // Sin venta asociada directa, es un saldo arrastrado
                  customerId,
                  new Date(), // Fecha actual
                  remainingDebtBs,
                  remainingDebtUsd,
                  `Saldo traslado de deuda ${entry.debt.sale_id ? 'Venta' : ''} (${new Date(entry.debt.created_at).toLocaleDateString()})`,
                  DebtStatus.OPEN,
                  entry.debt.id, // ID de la deuda padre
                ],
              );

              // 2. Registrar el pago interno "ROLLOVER" para cerrar la deuda original
              const rolloverPaymentId = randomUUID();
              await manager.query(
                `INSERT INTO debt_payments (id, store_id, debt_id, paid_at, amount_bs, amount_usd, method, note)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  rolloverPaymentId,
                  storeId,
                  entry.debt.id,
                  paidAt,
                  remainingDebtBs,
                  remainingDebtUsd,
                  'ROLLOVER',
                  `Traslado a nueva deuda (Corte)`,
                ],
              );

              // 3. Marcar la deuda original como PAGADA
              await manager
                .createQueryBuilder()
                .update(Debt)
                .set({ status: DebtStatus.PAID })
                .where('id = :debtId', { debtId: entry.debt.id })
                .execute();
            }
          }
        }
      }

      if (isSelective && requestedDebtIds && requestedDebtIds.length > 0) {
        const cutoffTimestamp = Math.max(
          ...sortedDebts.map((d) => new Date(d.created_at).getTime()),
        );
        if (cutoffTimestamp > 0) {
          await manager.query(
            `UPDATE customers
             SET debt_cutoff_at = GREATEST(COALESCE(debt_cutoff_at, 'epoch'::timestamptz), $1)
             WHERE id = $2 AND store_id = $3`,
            [new Date(cutoffTimestamp), customerId, storeId],
          );
        }
      }
    });

    this.logger.log(
      `${isSelective ? 'Pago selectivo' : 'Pago completo'} realizado para cliente ${customerId}: ${payments.length} pagos, ${updatedDebts.length} deudas actualizadas`,
    );

    return { debts: updatedDebts, payments };
  }

  async getCustomerDebtTimeline(
    storeId: string,
    customerId: string,
  ): Promise<any[]> {
    // 1. Obtener todas las deudas del cliente (incluyendo pagadas)
    const allDebts = await this.debtRepository.find({
      where: { store_id: storeId, customer_id: customerId },
      relations: [
        'payments',
        'parent_debt',
        'sale',
        'sale.items',
        'sale.items.product',
        'sale.items.variant',
      ],
      order: { created_at: 'ASC' },
    });

    // 2. Construir el árbol/línea de tiempo
    // Queremos agrupar "cadenas" de deudas: Deuda Original -> Rollover -> Deuda Nueva

    const timeline: any[] = [];
    const processedDebts = new Set<string>();

    for (const debt of allDebts) {
      if (processedDebts.has(debt.id)) continue;

      // Si tiene padre, probablemente ya fue procesada como hija de otra cadena
      // Pero si es una deuda raiz (sin padre), iniciamos una nueva cadena
      if (!debt.parent_debt_id) {
        const chain: any[] = [];
        let current: Debt | null = debt;

        while (current) {
          processedDebts.add(current.id);
          chain.push({
            type: 'debt',
            data: current,
          });

          // Agregar pagos de esta deuda a la cadena
          if (current.payments && current.payments.length > 0) {
            current.payments.forEach((p) => {
              chain.push({
                type: 'payment',
                data: p,
                debtId: current?.id,
              });
            });
          }

          // Buscar si esta deuda tuvo un hijo (fue rollover)
          // La forma eficiente seria tener un mapa, pero por simplicidad buscamos en el array en memoria
          const child = allDebts.find((d) => d.parent_debt_id === current?.id);
          current = child || null;
        }
        timeline.push({ type: 'chain', items: chain });
      }
    }

    // Ordenar timeline por fecha del primer elemento de la cadena
    return timeline.sort((a, b) => {
      const dateA = new Date(a.items[0].data.created_at).getTime();
      const dateB = new Date(b.items[0].data.created_at).getTime();
      return dateB - dateA; // Más recientes primero
    });
  }
}
