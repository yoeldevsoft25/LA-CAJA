import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, IsNull, Brackets } from 'typeorm';
import { CashSession } from '../database/entities/cash-session.entity';
import { Sale } from '../database/entities/sale.entity';
import {
  CashMovement,
  CashMovementType,
} from '../database/entities/cash-movement.entity';
import { Event } from '../database/entities/event.entity';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { AccountingService } from '../accounting/accounting.service';
import { randomUUID } from 'crypto';
import { SecurityAuditService } from '../security/security-audit.service';
import { FederationSyncService } from '../sync/federation-sync.service';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);
  private readonly serverDeviceId = '00000000-0000-0000-0000-000000000001';

  constructor(
    @InjectRepository(CashSession)
    private cashSessionRepository: Repository<CashSession>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(CashMovement)
    private cashMovementRepository: Repository<CashMovement>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private dataSource: DataSource,
    private accountingService: AccountingService,
    private securityAuditService: SecurityAuditService,
    private federationSyncService: FederationSyncService,
  ) {}

  private buildServerEvent(
    manager: EntityManager,
    params: {
      storeId: string;
      userId: string;
      role: string;
      type: string;
      createdAt: Date;
      seq: number;
      payload: Record<string, unknown>;
    },
  ): Event {
    return manager.create(Event, {
      event_id: randomUUID(),
      store_id: params.storeId,
      device_id: this.serverDeviceId,
      seq: params.seq,
      type: params.type,
      version: 1,
      created_at: params.createdAt,
      actor_user_id: params.userId,
      actor_role: params.role || 'owner',
      payload: params.payload,
      vector_clock: { [this.serverDeviceId]: params.seq },
      causal_dependencies: [],
      delta_payload: null,
      full_payload_hash: null,
    });
  }

  async openSession(
    storeId: string,
    userId: string,
    dto: OpenCashSessionDto,
    role = 'cashier',
  ): Promise<CashSession> {
    const { session, event } = await this.dataSource.transaction(
      async (manager) => {
        // Verificar si hay una sesión abierta
        const openSession = await manager.findOne(CashSession, {
          where: {
            store_id: storeId,
            opened_by: userId,
            closed_at: IsNull(), // Sesión abierta si closed_at es null
          },
        });

        if (openSession) {
          throw new BadRequestException('Ya tienes una sesión de caja abierta');
        }

        const openedAt = new Date();
        const session = manager.create(CashSession, {
          id: randomUUID(),
          store_id: storeId,
          opened_by: userId,
          opened_at: openedAt,
          opening_amount_bs: dto.cash_bs,
          opening_amount_usd: dto.cash_usd,
          note: dto.note || null,
        });

        const savedSession = await manager.save(CashSession, session);
        const event = this.buildServerEvent(manager, {
          storeId,
          userId,
          role,
          type: 'CashSessionOpened',
          createdAt: openedAt,
          seq: Date.now(),
          payload: {
            session_id: savedSession.id,
            opened_at: savedSession.opened_at?.toISOString(),
            opening_amount_bs: Number(savedSession.opening_amount_bs || 0),
            opening_amount_usd: Number(savedSession.opening_amount_usd || 0),
            note: savedSession.note || null,
          },
        });

        const savedEvent = await manager.save(Event, event);
        return { session: savedSession, event: savedEvent };
      },
    );

    await this.federationSyncService.queueRelay(event);
    return session;
  }

  async getCurrentSession(
    storeId: string,
    userId: string,
  ): Promise<CashSession | null> {
    return this.cashSessionRepository.findOne({
      where: {
        store_id: storeId,
        opened_by: userId,
        closed_at: IsNull(), // Sesión abierta si closed_at es null
      },
    });
  }

  async closeSession(
    storeId: string,
    userId: string,
    sessionId: string,
    dto: CloseCashSessionDto,
    userRole?: string,
  ): Promise<CashSession> {
    // ============================================
    // VALIDACIONES DE SEGURIDAD ANTI-TRAMPAS
    // ============================================

    const effectiveRole = userRole || 'cashier';

    // 1. Validar formato de montos (redondeo a 2 decimales)
    const countedBs = Math.round(Number(dto.counted_bs) * 100) / 100;
    const countedUsd = Math.round(Number(dto.counted_usd) * 100) / 100;

    if (isNaN(countedBs) || isNaN(countedUsd)) {
      throw new BadRequestException('Los montos deben ser números válidos');
    }

    if (countedBs < 0 || countedUsd < 0) {
      throw new BadRequestException(
        'Los montos contados no pueden ser negativos',
      );
    }

    const maxReasonableAmount = 1000000;
    if (countedBs > maxReasonableAmount || countedUsd > maxReasonableAmount) {
      throw new BadRequestException(
        'Los montos contados exceden el límite razonable. Verifica los valores.',
      );
    }

    // 2. Obtener sesión y validar que existe y está abierta
    const session = await this.cashSessionRepository.findOne({
      where: {
        id: sessionId,
        store_id: storeId,
        closed_at: IsNull(), // Solo cerrar si está abierta
      },
    });

    if (!session) {
      throw new NotFoundException('Sesión de caja no encontrada o ya cerrada');
    }

    if (
      session.opened_by !== userId &&
      effectiveRole !== 'owner' &&
      effectiveRole !== 'admin'
    ) {
      throw new ForbiddenException(
        'Solo el usuario que abrió la sesión o un administrador puede cerrarla.',
      );
    }

    // 3. Validar que la sesión no haya sido cerrada previamente (doble verificación)
    if (session.closed_at !== null) {
      throw new BadRequestException('Esta sesión ya fue cerrada previamente');
    }

    // 4. Calcular totales esperados de las ventas (DOBLE CÁLCULO PARA VERIFICACIÓN)
    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.store_id = :storeId', { storeId })
      .andWhere('sale.cash_session_id = :sessionId', { sessionId })
      .andWhere('sale.payment IS NOT NULL')
      .getMany();

    // Cálculo principal
    let expectedBs =
      Math.round(Number(session.opening_amount_bs || 0) * 100) / 100;
    let expectedUsd =
      Math.round(Number(session.opening_amount_usd || 0) * 100) / 100;

    // Cálculo secundario para verificación
    let expectedBsVerify =
      Math.round(Number(session.opening_amount_bs || 0) * 100) / 100;
    let expectedUsdVerify =
      Math.round(Number(session.opening_amount_usd || 0) * 100) / 100;

    // Sumar ingresos de ventas en efectivo
    for (const sale of sales) {
      const payment = sale.payment as any;
      const totals = sale.totals as any;

      if (!payment || !totals) {
        throw new BadRequestException(
          `Venta ${sale.id} tiene datos de pago o totales inválidos`,
        );
      }

      const totalBs = Math.round(Number(totals.total_bs || 0) * 100) / 100;
      const totalUsd = Math.round(Number(totals.total_usd || 0) * 100) / 100;

      if (payment.method === 'CASH_BS') {
        // LÓGICA ROBUSTA PARA PAGOS EN EFECTIVO Bs CON CAMBIO
        // La caja debe reflejar: +Bs recibido - Bs de cambio dado = Efectivo neto en caja
        if (payment.cash_payment_bs && payment.cash_payment_bs.received_bs) {
          // Cliente pagó con Bs físico: entra el Bs recibido (SIEMPRE)
          const receivedBs =
            Math.round(Number(payment.cash_payment_bs.received_bs) * 100) / 100;
          expectedBs = Math.round((expectedBs + receivedBs) * 100) / 100;
          expectedBsVerify =
            Math.round((expectedBsVerify + receivedBs) * 100) / 100;

          // Si se dio cambio en Bs (redondeado, solo si > 0), se descuenta del efectivo
          // NOTA: Si el cambio es menor a 5 Bs, se redondea a 0 y NO se envía change_bs
          // En ese caso, el excedente queda a favor del POS (no se descuenta nada)
          if (
            payment.cash_payment_bs.change_bs &&
            payment.cash_payment_bs.change_bs > 0
          ) {
            const changeBs =
              Math.round(Number(payment.cash_payment_bs.change_bs) * 100) / 100;
            expectedBs = Math.round((expectedBs - changeBs) * 100) / 100;
            expectedBsVerify =
              Math.round((expectedBsVerify - changeBs) * 100) / 100;
          }
          // Si change_bs es 0 o no existe, NO se descuenta nada (excedente a favor del POS)
        } else {
          // Pago exacto en Bs (sin especificar monto recibido, asumimos exacto)
          const amount = totalBs;
          expectedBs = Math.round((expectedBs + amount) * 100) / 100;
          expectedBsVerify =
            Math.round((expectedBsVerify + amount) * 100) / 100;
        }
      } else if (payment.method === 'CASH_USD') {
        // LÓGICA ROBUSTA PARA PAGOS EN USD FÍSICO CON CAMBIO EN Bs
        // La caja debe reflejar: +USD recibido - Bs de cambio dado = Efectivo neto en caja
        if (payment.cash_payment && payment.cash_payment.received_usd) {
          // Cliente pagó con USD físico: entra el USD recibido (SIEMPRE)
          const receivedUsd =
            Math.round(Number(payment.cash_payment.received_usd) * 100) / 100;
          expectedUsd = Math.round((expectedUsd + receivedUsd) * 100) / 100;
          expectedUsdVerify =
            Math.round((expectedUsdVerify + receivedUsd) * 100) / 100;

          // Si se dio cambio en Bs (redondeado, solo si > 0), se descuenta del efectivo en Bs
          // NOTA: Si el cambio es menor a 5 Bs, se redondea a 0 y NO se envía change_bs
          // En ese caso, el excedente queda a favor del POS (no se descuenta nada)
          if (
            payment.cash_payment.change_bs &&
            payment.cash_payment.change_bs > 0
          ) {
            const changeBs =
              Math.round(Number(payment.cash_payment.change_bs) * 100) / 100;
            expectedBs = Math.round((expectedBs - changeBs) * 100) / 100;
            expectedBsVerify =
              Math.round((expectedBsVerify - changeBs) * 100) / 100;
          }
          // Si change_bs es 0 o no existe, NO se descuenta nada (excedente a favor del POS)
        } else {
          // Pago exacto en USD (sin especificar monto recibido, asumimos exacto)
          const amount = totalUsd;
          expectedUsd = Math.round((expectedUsd + amount) * 100) / 100;
          expectedUsdVerify =
            Math.round((expectedUsdVerify + amount) * 100) / 100;
        }
      } else if (payment.method === 'SPLIT' && payment.split) {
        const cashBs =
          Math.round(Number(payment.split.cash_bs || 0) * 100) / 100;
        const cashUsd =
          Math.round(Number(payment.split.cash_usd || 0) * 100) / 100;
        expectedBs = Math.round((expectedBs + cashBs) * 100) / 100;
        expectedUsd = Math.round((expectedUsd + cashUsd) * 100) / 100;
        expectedBsVerify = Math.round((expectedBsVerify + cashBs) * 100) / 100;
        expectedUsdVerify =
          Math.round((expectedUsdVerify + cashUsd) * 100) / 100;
      }
      // PAGO_MOVIL, TRANSFER, OTHER, FIAO no se suman al efectivo
    }

    // Ajustar por movimientos de efectivo asociados a la sesión
    const closedAt = new Date();
    const movementTotals = await this.getMovementTotals(
      storeId,
      session,
      closedAt,
    );
    expectedBs = Math.round((expectedBs + movementTotals.net_bs) * 100) / 100;
    expectedUsd =
      Math.round((expectedUsd + movementTotals.net_usd) * 100) / 100;
    expectedBsVerify =
      Math.round((expectedBsVerify + movementTotals.net_bs) * 100) / 100;
    expectedUsdVerify =
      Math.round((expectedUsdVerify + movementTotals.net_usd) * 100) / 100;

    // 5. VERIFICACIÓN DE INTEGRIDAD: Los dos cálculos deben coincidir exactamente
    if (
      Math.abs(expectedBs - expectedBsVerify) > 0.01 ||
      Math.abs(expectedUsd - expectedUsdVerify) > 0.01
    ) {
      throw new BadRequestException(
        'Error de integridad: Los cálculos no coinciden. Por favor, contacte al administrador.',
      );
    }

    // 6. Validar que los montos contados sean razonables (no más del 200% del esperado + apertura)
    const maxReasonableBs =
      (expectedBs + Number(session.opening_amount_bs || 0)) * 2;
    const maxReasonableUsd =
      (expectedUsd + Number(session.opening_amount_usd || 0)) * 2;

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

    // 7. Calcular diferencias (con redondeo)
    // Las diferencias se calculan pero se usan implícitamente en el objeto counted
    const differenceBs = Math.round((countedBs - expectedBs) * 100) / 100;
    const differenceUsd = Math.round((countedUsd - expectedUsd) * 100) / 100;

    // 9. Guardar sesión cerrada (TODO ES INMUTABLE DESDE AQUÍ)
    session.closed_at = closedAt;
    session.closed_by = userId;
    session.expected = {
      cash_bs: expectedBs,
      cash_usd: expectedUsd,
    };
    session.counted = {
      cash_bs: countedBs,
      cash_usd: countedUsd,
    };
    session.note = dto.note || session.note;

    const { verifySession, closeEvent } = await this.dataSource.transaction(
      async (manager) => {
        await manager.save(CashSession, session);

        // 10. Verificación final: Re-leer la sesión y validar que se guardó correctamente
        const persisted = await manager.findOne(CashSession, {
          where: { id: sessionId, store_id: storeId },
        });

        if (!persisted || persisted.closed_at === null) {
          throw new BadRequestException(
            'Error al cerrar la sesión. Por favor, intente nuevamente o contacte al administrador.',
          );
        }

        // 11. Validar que los valores guardados coinciden con los enviados
        const savedCountedBs =
          Math.round(Number(persisted.counted?.cash_bs || 0) * 100) / 100;
        const savedCountedUsd =
          Math.round(Number(persisted.counted?.cash_usd || 0) * 100) / 100;

        if (
          Math.abs(savedCountedBs - countedBs) > 0.01 ||
          Math.abs(savedCountedUsd - countedUsd) > 0.01
        ) {
          throw new BadRequestException(
            'Error de integridad: Los valores guardados no coinciden. Por favor, contacte al administrador.',
          );
        }

        const event = this.buildServerEvent(manager, {
          storeId,
          userId,
          role: effectiveRole,
          type: 'CashSessionClosed',
          createdAt: persisted.closed_at || closedAt,
          seq: Date.now(),
          payload: {
            session_id: persisted.id,
            closed_at: persisted.closed_at?.toISOString(),
            expected: persisted.expected || null,
            counted: persisted.counted || null,
            note: persisted.note || null,
          },
        });

        const savedEvent = await manager.save(Event, event);
        return { verifySession: persisted, closeEvent: savedEvent };
      },
    );

    await this.federationSyncService.queueRelay(closeEvent);

    await this.securityAuditService.log({
      event_type: 'cash_session_closed',
      store_id: storeId,
      user_id: userId,
      status: 'success',
      details: {
        session_id: sessionId,
        expected_bs: expectedBs,
        expected_usd: expectedUsd,
        counted_bs: countedBs,
        counted_usd: countedUsd,
        difference_bs: differenceBs,
        difference_usd: differenceUsd,
      },
    });

    // Generar asiento contable automático para diferencias (fuera de la transacción)
    setImmediate(async () => {
      try {
        await this.accountingService.generateEntryFromCashClose(storeId, {
          id: verifySession.id,
          closed_at: verifySession.closed_at,
          opening_amount_bs: Number(verifySession.opening_amount_bs),
          opening_amount_usd: Number(verifySession.opening_amount_usd),
          expected: verifySession.expected,
          counted: verifySession.counted,
        });
      } catch (error) {
        // Log error pero no fallar el cierre de sesión
        this.logger.error(
          `Error generando asiento contable para cierre de caja ${verifySession.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });

    return verifySession;
  }

  async getSessionSummary(sessionId: string, storeId: string): Promise<any> {
    const session = await this.cashSessionRepository.findOne({
      where: { id: sessionId, store_id: storeId },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    // Obtener ventas de la sesión
    const sales = await this.saleRepository.find({
      where: { cash_session_id: sessionId, store_id: storeId },
      relations: ['items', 'items.product'],
    });

    // Calcular resumen por método de pago
    const summary = {
      session,
      sales_count: sales.length,
      sales: {
        total_bs: 0,
        total_usd: 0,
        by_method: {
          CASH_BS: 0,
          CASH_USD: 0,
          PAGO_MOVIL: 0,
          TRANSFER: 0,
          OTHER: 0,
          FIAO: 0,
          SPLIT: 0,
        },
      },
      cash_flow: {
        opening_bs: session.opening_amount_bs,
        opening_usd: session.opening_amount_usd,
        sales_bs: 0,
        sales_usd: 0,
        movements_bs: 0,
        movements_usd: 0,
        expected_bs: 0,
        expected_usd: 0,
      },
    };

    for (const sale of sales) {
      const totals = sale.totals as any;
      const totalBs = Number(totals.total_bs) || 0;
      const totalUsd = Number(totals.total_usd) || 0;

      summary.sales.total_bs += totalBs;
      summary.sales.total_usd += totalUsd;

      const payment = sale.payment as any;
      const method = payment.method;

      if (method in summary.sales.by_method) {
        if (method === 'CASH_USD') {
          summary.sales.by_method.CASH_USD += totalUsd;
        } else {
          summary.sales.by_method[method] += totalBs;
        }
      }

      // Sumar efectivo - LÓGICA IDÉNTICA A closeSession para garantizar consistencia
      if (method === 'CASH_BS') {
        // LÓGICA ROBUSTA: +Bs recibido - Bs de cambio = Efectivo neto
        if (payment.cash_payment_bs && payment.cash_payment_bs.received_bs) {
          const receivedBs = Number(payment.cash_payment_bs.received_bs || 0);
          summary.cash_flow.sales_bs += receivedBs;

          // Si se dio cambio en Bs (redondeado, solo si > 0), se descuenta
          // Si change_bs es 0 o no existe, NO se descuenta (excedente a favor del POS)
          if (
            payment.cash_payment_bs.change_bs &&
            payment.cash_payment_bs.change_bs > 0
          ) {
            const changeBs = Number(payment.cash_payment_bs.change_bs);
            summary.cash_flow.sales_bs -= changeBs; // Se descuenta porque salió de la caja
          }
        } else {
          // Pago exacto: suma el total
          summary.cash_flow.sales_bs += totalBs;
        }
      } else if (method === 'CASH_USD') {
        // LÓGICA ROBUSTA: +USD recibido - Bs de cambio = Efectivo neto
        if (payment.cash_payment && payment.cash_payment.received_usd) {
          const receivedUsd = Number(payment.cash_payment.received_usd || 0);
          summary.cash_flow.sales_usd += receivedUsd;

          // Si se dio cambio en Bs (redondeado, solo si > 0), se descuenta
          // Si change_bs es 0 o no existe, NO se descuenta (excedente a favor del POS)
          if (
            payment.cash_payment.change_bs &&
            payment.cash_payment.change_bs > 0
          ) {
            const changeBs = Number(payment.cash_payment.change_bs);
            summary.cash_flow.sales_bs -= changeBs; // Se descuenta porque salió de la caja
          }
        } else {
          // Pago exacto: suma el total
          summary.cash_flow.sales_usd += totalUsd;
        }
      } else if (method === 'SPLIT' && payment.split) {
        summary.cash_flow.sales_bs += Number(payment.split.cash_bs) || 0;
        summary.cash_flow.sales_usd += Number(payment.split.cash_usd) || 0;
      }
    }

    const summaryEndAt = session.closed_at || new Date();
    const summaryMovements = await this.getMovementTotals(
      storeId,
      session,
      summaryEndAt,
    );

    summary.cash_flow.opening_bs = Number(session.opening_amount_bs) || 0;
    summary.cash_flow.opening_usd = Number(session.opening_amount_usd) || 0;
    summary.cash_flow.movements_bs = summaryMovements.net_bs;
    summary.cash_flow.movements_usd = summaryMovements.net_usd;
    summary.cash_flow.expected_bs =
      summary.cash_flow.opening_bs +
      summary.cash_flow.sales_bs +
      summary.cash_flow.movements_bs;
    summary.cash_flow.expected_usd =
      summary.cash_flow.opening_usd +
      summary.cash_flow.sales_usd +
      summary.cash_flow.movements_usd;

    if (session.counted && session.expected) {
      summary['closing'] = {
        expected: session.expected,
        counted: session.counted,
        difference_bs: session.counted.cash_bs - session.expected.cash_bs,
        difference_usd: session.counted.cash_usd - session.expected.cash_usd,
        note: session.note,
      };
    }

    return summary;
  }

  private async getMovementTotals(
    storeId: string,
    session: CashSession,
    endAt: Date,
  ): Promise<{
    entries_bs: number;
    entries_usd: number;
    exits_bs: number;
    exits_usd: number;
    net_bs: number;
    net_usd: number;
    total: number;
  }> {
    const movements = await this.cashMovementRepository
      .createQueryBuilder('movement')
      .where('movement.store_id = :storeId', { storeId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('movement.cash_session_id = :sessionId', {
            sessionId: session.id,
          }).orWhere(
            'movement.cash_session_id IS NULL AND movement.created_at >= :openedAt AND movement.created_at <= :endAt AND movement.created_by = :openedBy',
            {
              openedAt: session.opened_at,
              endAt,
              openedBy: session.opened_by,
            },
          );
        }),
      )
      .getMany();

    let entriesBs = 0;
    let entriesUsd = 0;
    let exitsBs = 0;
    let exitsUsd = 0;

    for (const movement of movements) {
      if (movement.movement_type === CashMovementType.ENTRY) {
        entriesBs += Number(movement.amount_bs || 0);
        entriesUsd += Number(movement.amount_usd || 0);
      } else {
        exitsBs += Number(movement.amount_bs || 0);
        exitsUsd += Number(movement.amount_usd || 0);
      }
    }

    const roundTwo = (value: number) => Math.round(value * 100) / 100;

    return {
      entries_bs: roundTwo(entriesBs),
      entries_usd: roundTwo(entriesUsd),
      exits_bs: roundTwo(exitsBs),
      exits_usd: roundTwo(exitsUsd),
      net_bs: roundTwo(entriesBs - exitsBs),
      net_usd: roundTwo(entriesUsd - exitsUsd),
      total: movements.length,
    };
  }

  async listSessions(
    storeId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ sessions: CashSession[]; total: number }> {
    const query = this.cashSessionRepository
      .createQueryBuilder('session')
      .where('session.store_id = :storeId', { storeId })
      .orderBy('session.opened_at', 'DESC');

    const total = await query.getCount();

    query.limit(limit).offset(offset);

    const sessions = await query.getMany();

    return { sessions, total };
  }
}
