import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccountingPeriod,
  AccountingPeriodStatus,
} from '../database/entities/accounting-period.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { AccountingService } from './accounting.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AccountingPeriodService {
  private readonly logger = new Logger(AccountingPeriodService.name);

  constructor(
    @InjectRepository(AccountingPeriod)
    private periodRepository: Repository<AccountingPeriod>,
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private journalEntryLineRepository: Repository<JournalEntryLine>,
    @InjectRepository(ChartOfAccount)
    private accountRepository: Repository<ChartOfAccount>,
    // TODO [Technical Debt - Sprint 4.3]: Circular dependency with AccountingService.
    // Current strategy: Use forwardRef to allow logic extraction without breaking legacy coupling.
    // Next step: Extract shared helpers (entry generation, balances) to a third 'AccountingSharedService' to break the cycle.
    @Inject(forwardRef(() => AccountingService))
    private accountingService: AccountingService,
  ) {}

  /**
   * Obtener o crear período contable para una fecha
   */
  async getOrCreatePeriod(
    storeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AccountingPeriod> {
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth() + 1;
    const periodCode = `${year}-${String(month).padStart(2, '0')}`;

    let period = await this.periodRepository.findOne({
      where: { store_id: storeId, period_code: periodCode },
    });

    if (!period) {
      period = this.periodRepository.create({
        id: randomUUID(),
        store_id: storeId,
        period_code: periodCode,
        period_start: periodStart,
        period_end: periodEnd,
        status: AccountingPeriodStatus.OPEN,
        created_at: new Date(),
        updated_at: new Date(),
      });
      await this.periodRepository.save(period);
    }

    return period;
  }

  /**
   * Validar si un período está abierto
   */
  async validatePeriodOpen(storeId: string, entryDate: Date): Promise<void> {
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth();
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0);

    const period = await this.getOrCreatePeriod(
      storeId,
      periodStart,
      periodEnd,
    );

    if (
      period.status === AccountingPeriodStatus.CLOSED ||
      period.status === AccountingPeriodStatus.LOCKED
    ) {
      throw new BadRequestException(
        `El período ${period.period_code} está cerrado o bloqueado. No se pueden registrar transacciones.`,
      );
    }
  }

  /**
   * Cerrar un período contable (genera asientos de cierre)
   */
  async closePeriod(
    storeId: string,
    periodStart: Date,
    periodEnd: Date,
    userId: string,
    note?: string,
  ): Promise<{ period: AccountingPeriod; closingEntry: JournalEntry }> {
    const period = await this.getOrCreatePeriod(
      storeId,
      periodStart,
      periodEnd,
    );

    if (
      period.status === AccountingPeriodStatus.CLOSED ||
      period.status === AccountingPeriodStatus.LOCKED
    ) {
      throw new BadRequestException(
        `El período ${period.period_code} ya está cerrado`,
      );
    }

    // Obtener Estado de Resultados del período vía AccountingService
    const incomeStatement = await this.accountingService.getIncomeStatement(
      storeId,
      periodStart,
      periodEnd,
    );
    const netIncomeBs = incomeStatement.totals.net_income_bs;
    const netIncomeUsd = incomeStatement.totals.net_income_usd;

    // Si no hay ingreso neto, no generar asiento de cierre
    if (Math.abs(netIncomeBs) < 0.01 && Math.abs(netIncomeUsd) < 0.01) {
      period.status = AccountingPeriodStatus.CLOSED;
      period.closed_at = new Date();
      period.closed_by = userId;
      period.closing_note = note || null;
      await this.periodRepository.save(period);

      // Retornar sin asiento de cierre
      return {
        period,
        closingEntry: null as any, // No hay asiento porque no hay utilidad
      };
    }

    // Obtener cuentas de ingresos y gastos
    const revenueAccounts = await this.accountRepository.find({
      where: {
        store_id: storeId,
        account_type: 'revenue',
        is_active: true,
      },
    });

    const expenseAccounts = await this.accountRepository.find({
      where: {
        store_id: storeId,
        account_type: 'expense',
        is_active: true,
      },
    });

    // Buscar cuenta de ganancias retenidas (3.02.01) o capital (3.01.01) como fallback
    let equityAccount = await this.accountRepository.findOne({
      where: {
        store_id: storeId,
        account_type: 'equity',
        account_code: '3.02.01', // Utilidades Acumuladas (Ganancias Retenidas)
        is_active: true,
      },
    });

    if (!equityAccount) {
      // Buscar cualquier cuenta de Ganancias Retenidas (3.02)
      equityAccount = await this.accountRepository.findOne({
        where: {
          store_id: storeId,
          account_type: 'equity',
          account_code: '3.02',
          is_active: true,
        },
      });
    }

    if (!equityAccount) {
      // Fallback: usar Capital Social (3.01.01)
      equityAccount = await this.accountRepository.findOne({
        where: {
          store_id: storeId,
          account_type: 'equity',
          account_code: '3.01.01',
          is_active: true,
        },
      });
    }

    if (!equityAccount) {
      // Último fallback: cualquier cuenta de capital (3.01)
      equityAccount = await this.accountRepository.findOne({
        where: {
          store_id: storeId,
          account_type: 'equity',
          account_code: '3.01',
          is_active: true,
        },
      });
    }

    if (!equityAccount) {
      throw new NotFoundException(
        'No se encontró cuenta de capital o ganancias retenidas para el cierre',
      );
    }

    const entryDate = periodEnd;
    const entryNumber = await this.accountingService.generateEntryNumber(
      storeId,
      entryDate,
    );

    const lines: Array<{
      account_id: string;
      account_code: string;
      account_name: string;
      debit_amount_bs: number;
      credit_amount_bs: number;
      debit_amount_usd: number;
      credit_amount_usd: number;
      description?: string;
    }> = [];

    // Optimización: Calcular balances de revenue accounts en batch vía AccountingService
    const revenueAccountIds = revenueAccounts.map((a) => a.id);
    const revenueBalances =
      revenueAccountIds.length > 0
        ? await this.accountingService.calculateAccountBalancesBatch(
            storeId,
            revenueAccountIds,
            periodEnd,
          )
        : new Map();

    // Cerrar ingresos: Débito a Ingresos, Crédito a Ganancias Retenidas
    for (const account of revenueAccounts) {
      const balance = revenueBalances.get(account.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      const revenueAmountBs = balance.balance_bs;
      const revenueAmountUsd = balance.balance_usd;

      if (
        Math.abs(revenueAmountBs) < 0.01 &&
        Math.abs(revenueAmountUsd) < 0.01
      ) {
        continue;
      }

      // Débito: Ingreso (para cerrarlo)
      lines.push({
        account_id: account.id,
        account_code: account.account_code,
        account_name: account.account_name,
        debit_amount_bs: Math.abs(revenueAmountBs),
        credit_amount_bs: 0,
        debit_amount_usd: Math.abs(revenueAmountUsd),
        credit_amount_usd: 0,
        description: `Cierre de período - ${account.account_name}`,
      });

      // Crédito: Ganancias Retenidas
      if (equityAccount) {
        lines.push({
          account_id: equityAccount.id,
          account_code: equityAccount.account_code,
          account_name: equityAccount.account_name,
          debit_amount_bs: 0,
          credit_amount_bs: Math.abs(revenueAmountBs),
          debit_amount_usd: 0,
          credit_amount_usd: Math.abs(revenueAmountUsd),
          description: `Transferencia de ingresos - ${account.account_name}`,
        });
      }
    }

    // Optimización: Calcular balances de expense accounts en batch vía AccountingService
    const expenseAccountIds = expenseAccounts.map((a) => a.id);
    const expenseBalances =
      expenseAccountIds.length > 0
        ? await this.accountingService.calculateAccountBalancesBatch(
            storeId,
            expenseAccountIds,
            periodEnd,
          )
        : new Map();

    // Cerrar gastos: Crédito a Gasto, Débito a Ganancias Retenidas
    for (const account of expenseAccounts) {
      const balance = expenseBalances.get(account.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      const expenseAmountBs = Math.abs(balance.balance_bs);
      const expenseAmountUsd = Math.abs(balance.balance_usd);

      if (
        Math.abs(expenseAmountBs) < 0.01 &&
        Math.abs(expenseAmountUsd) < 0.01
      ) {
        continue;
      }

      // Crédito: Gasto (para cerrarlo)
      lines.push({
        account_id: account.id,
        account_code: account.account_code,
        account_name: account.account_name,
        debit_amount_bs: 0,
        credit_amount_bs: expenseAmountBs,
        debit_amount_usd: 0,
        credit_amount_usd: expenseAmountUsd,
        description: `Cierre de período - ${account.account_name}`,
      });

      // Débito: Ganancias Retenidas
      if (equityAccount) {
        lines.push({
          account_id: equityAccount.id,
          account_code: equityAccount.account_code,
          account_name: equityAccount.account_name,
          debit_amount_bs: expenseAmountBs,
          credit_amount_bs: 0,
          debit_amount_usd: expenseAmountUsd,
          credit_amount_usd: 0,
          description: `Transferencia de gastos - ${account.account_name}`,
        });
      }
    }

    // Crear asiento de cierre
    const closingEntry = this.journalEntryRepository.create({
      id: randomUUID(),
      store_id: storeId,
      entry_number: entryNumber,
      entry_date: entryDate,
      entry_type: 'manual',
      source_type: 'period_close',
      source_id: period.id,
      description: `Cierre de período ${period.period_code}`,
      reference_number: null,
      total_debit_bs: lines.reduce((sum, l) => sum + l.debit_amount_bs, 0),
      total_credit_bs: lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
      total_debit_usd: lines.reduce((sum, l) => sum + l.debit_amount_usd, 0),
      total_credit_usd: lines.reduce((sum, l) => sum + l.credit_amount_usd, 0),
      exchange_rate: null,
      currency: 'MIXED',
      status: 'posted',
      is_auto_generated: true,
      posted_at: new Date(),
      posted_by: userId,
      metadata: { period_id: period.id, period_code: period.period_code },
    });

    const savedEntry = await this.journalEntryRepository.save(closingEntry);

    // Crear líneas
    const entryLines = lines.map((line, index) =>
      this.journalEntryLineRepository.create({
        id: randomUUID(),
        entry_id: savedEntry.id,
        line_number: index + 1,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        description: line.description,
        debit_amount_bs: line.debit_amount_bs,
        credit_amount_bs: line.credit_amount_bs,
        debit_amount_usd: line.debit_amount_usd,
        credit_amount_usd: line.credit_amount_usd,
      }),
    );

    await this.journalEntryLineRepository.save(entryLines);

    // Actualizar saldos vía AccountingService
    await this.accountingService.updateAccountBalances(
      storeId,
      entryDate,
      lines,
    );

    // Actualizar período
    period.status = AccountingPeriodStatus.CLOSED;
    period.closed_at = new Date();
    period.closed_by = userId;
    period.closing_entry_id = savedEntry.id;
    period.closing_note = note || null;
    await this.periodRepository.save(period);

    const entryWithLines = await this.journalEntryRepository.findOne({
      where: { id: savedEntry.id },
      relations: ['lines'],
    });

    return {
      period,
      closingEntry: entryWithLines as JournalEntry,
    };
  }

  /**
   * Reabrir un período cerrado
   */
  async reopenPeriod(
    storeId: string,
    periodCode: string,
    userId: string,
    reason: string,
  ): Promise<AccountingPeriod> {
    const period = await this.periodRepository.findOne({
      where: { store_id: storeId, period_code: periodCode },
    });

    if (!period) {
      throw new NotFoundException(`Período ${periodCode} no encontrado`);
    }

    if (period.status === AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(
        `El período ${periodCode} está bloqueado y no se puede reabrir`,
      );
    }

    if (period.status === AccountingPeriodStatus.OPEN) {
      throw new BadRequestException(`El período ${periodCode} ya está abierto`);
    }

    // Revertir asiento de cierre si existe
    if (period.closing_entry_id) {
      const closingEntry = await this.journalEntryRepository.findOne({
        where: { id: period.closing_entry_id },
      });

      if (closingEntry && closingEntry.status === 'posted') {
        closingEntry.status = 'cancelled';
        closingEntry.cancelled_at = new Date();
        closingEntry.cancelled_by = userId;
        closingEntry.cancellation_reason = `Período reabierto: ${reason}`;
        await this.journalEntryRepository.save(closingEntry);
      }
    }

    period.status = AccountingPeriodStatus.OPEN;
    period.closed_at = null;
    period.closing_entry_id = null;
    period.closing_note = `${period.closing_note || ''}\n[Reabierto: ${new Date().toISOString()}] Razón: ${reason}`;
    await this.periodRepository.save(period);

    return period;
  }
}
