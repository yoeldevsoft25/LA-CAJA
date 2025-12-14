import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { CashSession } from '../database/entities/cash-session.entity';
import { Sale } from '../database/entities/sale.entity';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashSession)
    private cashSessionRepository: Repository<CashSession>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    private dataSource: DataSource,
  ) {}

  async openSession(storeId: string, userId: string, dto: OpenCashSessionDto): Promise<CashSession> {
    // Verificar si hay una sesión abierta
    const openSession = await this.cashSessionRepository.findOne({
      where: {
        store_id: storeId,
        closed_at: IsNull(), // Sesión abierta si closed_at es null
      },
    });

    if (openSession) {
      throw new BadRequestException('Ya existe una sesión de caja abierta');
    }

    const session = this.cashSessionRepository.create({
      id: randomUUID(),
      store_id: storeId,
      opened_by: userId,
      opened_at: new Date(),
      opening_amount_bs: dto.cash_bs,
      opening_amount_usd: dto.cash_usd,
      note: dto.note || null,
    });

    return this.cashSessionRepository.save(session);
  }

  async getCurrentSession(storeId: string): Promise<CashSession | null> {
    return this.cashSessionRepository.findOne({
      where: {
        store_id: storeId,
        closed_at: IsNull(), // Sesión abierta si closed_at es null
      },
    });
  }

  async closeSession(
    storeId: string,
    userId: string,
    sessionId: string,
    dto: CloseCashSessionDto,
  ): Promise<CashSession> {
    // ============================================
    // VALIDACIONES DE SEGURIDAD ANTI-TRAMPAS
    // ============================================

    // 1. Validar formato de montos (redondeo a 2 decimales)
    const countedBs = Math.round(Number(dto.counted_bs) * 100) / 100;
    const countedUsd = Math.round(Number(dto.counted_usd) * 100) / 100;

    if (isNaN(countedBs) || isNaN(countedUsd)) {
      throw new BadRequestException('Los montos deben ser números válidos');
    }

    if (countedBs < 0 || countedUsd < 0) {
      throw new BadRequestException('Los montos contados no pueden ser negativos');
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
    let expectedBs = Math.round(Number(session.opening_amount_bs || 0) * 100) / 100;
    let expectedUsd = Math.round(Number(session.opening_amount_usd || 0) * 100) / 100;

    // Cálculo secundario para verificación
    let expectedBsVerify = Math.round(Number(session.opening_amount_bs || 0) * 100) / 100;
    let expectedUsdVerify = Math.round(Number(session.opening_amount_usd || 0) * 100) / 100;

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
          const receivedBs = Math.round(Number(payment.cash_payment_bs.received_bs) * 100) / 100;
          expectedBs = Math.round((expectedBs + receivedBs) * 100) / 100;
          expectedBsVerify = Math.round((expectedBsVerify + receivedBs) * 100) / 100;

          // Si se dio cambio en Bs (redondeado, solo si > 0), se descuenta del efectivo
          // NOTA: Si el cambio es menor a 5 Bs, se redondea a 0 y NO se envía change_bs
          // En ese caso, el excedente queda a favor del POS (no se descuenta nada)
          if (payment.cash_payment_bs.change_bs && payment.cash_payment_bs.change_bs > 0) {
            const changeBs = Math.round(Number(payment.cash_payment_bs.change_bs) * 100) / 100;
            expectedBs = Math.round((expectedBs - changeBs) * 100) / 100;
            expectedBsVerify = Math.round((expectedBsVerify - changeBs) * 100) / 100;
          }
          // Si change_bs es 0 o no existe, NO se descuenta nada (excedente a favor del POS)
        } else {
          // Pago exacto en Bs (sin especificar monto recibido, asumimos exacto)
          const amount = totalBs;
          expectedBs = Math.round((expectedBs + amount) * 100) / 100;
          expectedBsVerify = Math.round((expectedBsVerify + amount) * 100) / 100;
        }
      } else if (payment.method === 'CASH_USD') {
        // LÓGICA ROBUSTA PARA PAGOS EN USD FÍSICO CON CAMBIO EN Bs
        // La caja debe reflejar: +USD recibido - Bs de cambio dado = Efectivo neto en caja
        if (payment.cash_payment && payment.cash_payment.received_usd) {
          // Cliente pagó con USD físico: entra el USD recibido (SIEMPRE)
          const receivedUsd = Math.round(Number(payment.cash_payment.received_usd) * 100) / 100;
          expectedUsd = Math.round((expectedUsd + receivedUsd) * 100) / 100;
          expectedUsdVerify = Math.round((expectedUsdVerify + receivedUsd) * 100) / 100;

          // Si se dio cambio en Bs (redondeado, solo si > 0), se descuenta del efectivo en Bs
          // NOTA: Si el cambio es menor a 5 Bs, se redondea a 0 y NO se envía change_bs
          // En ese caso, el excedente queda a favor del POS (no se descuenta nada)
          if (payment.cash_payment.change_bs && payment.cash_payment.change_bs > 0) {
            const changeBs = Math.round(Number(payment.cash_payment.change_bs) * 100) / 100;
            expectedBs = Math.round((expectedBs - changeBs) * 100) / 100;
            expectedBsVerify = Math.round((expectedBsVerify - changeBs) * 100) / 100;
          }
          // Si change_bs es 0 o no existe, NO se descuenta nada (excedente a favor del POS)
        } else {
          // Pago exacto en USD (sin especificar monto recibido, asumimos exacto)
          const amount = totalUsd;
          expectedUsd = Math.round((expectedUsd + amount) * 100) / 100;
          expectedUsdVerify = Math.round((expectedUsdVerify + amount) * 100) / 100;
        }
      } else if (payment.method === 'SPLIT' && payment.split) {
        const cashBs = Math.round(Number(payment.split.cash_bs || 0) * 100) / 100;
        const cashUsd = Math.round(Number(payment.split.cash_usd || 0) * 100) / 100;
        expectedBs = Math.round((expectedBs + cashBs) * 100) / 100;
        expectedUsd = Math.round((expectedUsd + cashUsd) * 100) / 100;
        expectedBsVerify = Math.round((expectedBsVerify + cashBs) * 100) / 100;
        expectedUsdVerify = Math.round((expectedUsdVerify + cashUsd) * 100) / 100;
      }
      // PAGO_MOVIL, TRANSFER, OTHER, FIAO no se suman al efectivo
    }

    // 5. VERIFICACIÓN DE INTEGRIDAD: Los dos cálculos deben coincidir exactamente
    if (Math.abs(expectedBs - expectedBsVerify) > 0.01 || Math.abs(expectedUsd - expectedUsdVerify) > 0.01) {
      throw new BadRequestException(
        'Error de integridad: Los cálculos no coinciden. Por favor, contacte al administrador.',
      );
    }

    // 6. Validar que los montos contados sean razonables (no más del 200% del esperado + apertura)
    const maxReasonableBs = (expectedBs + Number(session.opening_amount_bs || 0)) * 2;
    const maxReasonableUsd = (expectedUsd + Number(session.opening_amount_usd || 0)) * 2;

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
    const differenceBs = Math.round((countedBs - expectedBs) * 100) / 100;
    const differenceUsd = Math.round((countedUsd - expectedUsd) * 100) / 100;

    // 8. Registrar timestamp preciso antes de guardar
    const closedAt = new Date();

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

    const savedSession = await this.cashSessionRepository.save(session);

    // 10. Verificación final: Re-leer la sesión y validar que se guardó correctamente
    const verifySession = await this.cashSessionRepository.findOne({
      where: { id: sessionId, store_id: storeId },
    });

    if (!verifySession || verifySession.closed_at === null) {
      throw new BadRequestException(
        'Error al cerrar la sesión. Por favor, intente nuevamente o contacte al administrador.',
      );
    }

    // 11. Validar que los valores guardados coinciden con los enviados
    const savedCountedBs = Math.round(Number(verifySession.counted?.cash_bs || 0) * 100) / 100;
    const savedCountedUsd = Math.round(Number(verifySession.counted?.cash_usd || 0) * 100) / 100;

    if (
      Math.abs(savedCountedBs - countedBs) > 0.01 ||
      Math.abs(savedCountedUsd - countedUsd) > 0.01
    ) {
      throw new BadRequestException(
        'Error de integridad: Los valores guardados no coinciden. Por favor, contacte al administrador.',
      );
    }

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
        summary.sales.by_method[method] += totalBs;
      }

      // Sumar efectivo - LÓGICA IDÉNTICA A closeSession para garantizar consistencia
      if (method === 'CASH_BS') {
        // LÓGICA ROBUSTA: +Bs recibido - Bs de cambio = Efectivo neto
        if (payment.cash_payment_bs && payment.cash_payment_bs.received_bs) {
          const receivedBs = Number(payment.cash_payment_bs.received_bs || 0);
          summary.cash_flow.sales_bs += receivedBs;
          
          // Si se dio cambio en Bs (redondeado, solo si > 0), se descuenta
          // Si change_bs es 0 o no existe, NO se descuenta (excedente a favor del POS)
          if (payment.cash_payment_bs.change_bs && payment.cash_payment_bs.change_bs > 0) {
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
          if (payment.cash_payment.change_bs && payment.cash_payment.change_bs > 0) {
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

    summary.cash_flow.opening_bs = Number(session.opening_amount_bs) || 0;
    summary.cash_flow.opening_usd = Number(session.opening_amount_usd) || 0;
    summary.cash_flow.expected_bs = summary.cash_flow.opening_bs + summary.cash_flow.sales_bs;
    summary.cash_flow.expected_usd = summary.cash_flow.opening_usd + summary.cash_flow.sales_usd;

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

