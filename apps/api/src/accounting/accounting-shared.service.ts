import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { AccountBalance } from '../database/entities/account-balance.entity';
import { randomUUID } from 'crypto';

/**
 * AccountingSharedService
 *
 * Shared helper methods for accounting operations.
 * Extracted from AccountingService to break circular dependency with AccountingPeriodService.
 */
@Injectable()
export class AccountingSharedService {
  private readonly logger = new Logger(AccountingSharedService.name);

  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private journalEntryLineRepository: Repository<JournalEntryLine>,
    @InjectRepository(ChartOfAccount)
    private accountRepository: Repository<ChartOfAccount>,
    @InjectRepository(AccountBalance)
    private balanceRepository: Repository<AccountBalance>,
  ) {}

  /**
   * Generar número de asiento único
   */
  async generateEntryNumber(storeId: string, entryDate: Date): Promise<string> {
    const year = entryDate.getFullYear();
    const month = String(entryDate.getMonth() + 1).padStart(2, '0');

    // Buscar último asiento del mes
    const lastEntry = await this.journalEntryRepository.findOne({
      where: {
        store_id: storeId,
        entry_date: Between(
          new Date(year, entryDate.getMonth(), 1),
          new Date(year, entryDate.getMonth() + 1, 0),
        ),
      },
      order: { entry_number: 'DESC' },
    });

    let sequence = 1;
    if (lastEntry) {
      const lastSequence = parseInt(
        lastEntry.entry_number.split('-').pop() || '0',
        10,
      );
      sequence = lastSequence + 1;
    }

    return `AS-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Calcular saldos de múltiples cuentas hasta una fecha específica (optimizado para batch)
   * Evita N+1 queries cuando se necesitan balances de múltiples cuentas
   */
  async calculateAccountBalancesBatch(
    storeId: string,
    accountIds: string[],
    asOfDate: Date,
  ): Promise<Map<string, { balance_bs: number; balance_usd: number }>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    // Obtener todos los asientos posteados hasta la fecha para todas las cuentas en una query
    const balances = await this.journalEntryLineRepository
      .createQueryBuilder('line')
      .innerJoin('line.entry', 'entry')
      .where('entry.store_id = :storeId', { storeId })
      .andWhere('line.account_id IN (:...accountIds)', { accountIds })
      .andWhere('entry.status = :status', { status: 'posted' })
      .andWhere('entry.entry_date <= :asOfDate', { asOfDate })
      .select('line.account_id', 'account_id')
      .addSelect('SUM(line.debit_amount_bs)', 'total_debit_bs')
      .addSelect('SUM(line.credit_amount_bs)', 'total_credit_bs')
      .addSelect('SUM(line.debit_amount_usd)', 'total_debit_usd')
      .addSelect('SUM(line.credit_amount_usd)', 'total_credit_usd')
      .groupBy('line.account_id')
      .getRawMany();

    // Obtener tipos de cuenta para todas las cuentas en una query
    const accounts = await this.accountRepository.find({
      where: { id: In(accountIds), store_id: storeId },
      select: ['id', 'account_type'],
    });

    const accountTypesMap = new Map(
      accounts.map((a) => [a.id, a.account_type]),
    );

    const result = new Map<
      string,
      { balance_bs: number; balance_usd: number }
    >();

    for (const accountId of accountIds) {
      const balanceData = balances.find((b) => b.account_id === accountId);
      const accountType = accountTypesMap.get(accountId);

      if (!accountType) {
        result.set(accountId, { balance_bs: 0, balance_usd: 0 });
        continue;
      }

      const totalDebitBs = Number(balanceData?.total_debit_bs || 0);
      const totalCreditBs = Number(balanceData?.total_credit_bs || 0);
      const totalDebitUsd = Number(balanceData?.total_debit_usd || 0);
      const totalCreditUsd = Number(balanceData?.total_credit_usd || 0);

      let balanceBs = 0;
      let balanceUsd = 0;

      if (accountType === 'asset' || accountType === 'expense') {
        balanceBs = totalDebitBs - totalCreditBs;
        balanceUsd = totalDebitUsd - totalCreditUsd;
      } else {
        balanceBs = totalCreditBs - totalDebitBs;
        balanceUsd = totalCreditUsd - totalDebitUsd;
      }

      result.set(accountId, { balance_bs: balanceBs, balance_usd: balanceUsd });
    }

    return result;
  }

  /**
   * Actualizar saldos de cuentas (optimizado con batch queries)
   */
  async updateAccountBalances(
    storeId: string,
    entryDate: Date,
    lines: Array<{
      account_id: string;
      debit_amount_bs: number;
      credit_amount_bs: number;
      debit_amount_usd: number;
      credit_amount_usd: number;
    }>,
  ): Promise<void> {
    if (lines.length === 0) return;

    const year = entryDate.getFullYear();
    const month = entryDate.getMonth();
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0);

    // ⚡ OPTIMIZACIÓN: Obtener todos los account_ids únicos
    const accountIds = [...new Set(lines.map((l) => l.account_id))];

    // ⚡ OPTIMIZACIÓN: Batch query para balances existentes
    const existingBalances = await this.balanceRepository.find({
      where: {
        store_id: storeId,
        account_id: In(accountIds),
        period_start: periodStart,
        period_end: periodEnd,
      },
    });

    // ⚡ OPTIMIZACIÓN: Batch query para cuentas faltantes
    const missingAccountIds = accountIds.filter(
      (id) => !existingBalances.some((b) => b.account_id === id),
    );
    const accounts =
      missingAccountIds.length > 0
        ? await this.accountRepository.find({
            where: { id: In(missingAccountIds) },
          })
        : [];

    // Crear mapa de balances existentes
    const balanceMap = new Map<string, AccountBalance>();
    for (const balance of existingBalances) {
      balanceMap.set(balance.account_id, balance);
    }

    // Crear mapa de cuentas
    const accountMap = new Map<string, ChartOfAccount>();
    for (const account of accounts) {
      accountMap.set(account.id, account);
    }

    // Agrupar líneas por account_id para sumar valores
    const lineMap = new Map<
      string,
      {
        debit_bs: number;
        credit_bs: number;
        debit_usd: number;
        credit_usd: number;
      }
    >();

    for (const line of lines) {
      const existing = lineMap.get(line.account_id) || {
        debit_bs: 0,
        credit_bs: 0,
        debit_usd: 0,
        credit_usd: 0,
      };
      existing.debit_bs += Number(line.debit_amount_bs) || 0;
      existing.credit_bs += Number(line.credit_amount_bs) || 0;
      existing.debit_usd += Number(line.debit_amount_usd) || 0;
      existing.credit_usd += Number(line.credit_amount_usd) || 0;
      lineMap.set(line.account_id, existing);
    }

    // Preparar balances para actualizar/crear
    const balancesToSave: AccountBalance[] = [];

    for (const [accountId, totals] of lineMap.entries()) {
      let balance = balanceMap.get(accountId);

      if (!balance) {
        const account = accountMap.get(accountId);
        if (!account) {
          this.logger.warn(
            `Cuenta ${accountId} no encontrada, omitiendo actualización de saldo`,
          );
          continue;
        }

        balance = this.balanceRepository.create({
          id: randomUUID(),
          store_id: storeId,
          account_id: accountId,
          account_code: account.account_code,
          period_start: periodStart,
          period_end: periodEnd,
          opening_balance_debit_bs: 0,
          opening_balance_credit_bs: 0,
          opening_balance_debit_usd: 0,
          opening_balance_credit_usd: 0,
          period_debit_bs: 0,
          period_credit_bs: 0,
          period_debit_usd: 0,
          period_credit_usd: 0,
        });
      }

      // ⚠️ FIX: Asegurar que los valores numéricos no sean null/undefined/NaN
      const safeNumber = (val: any): number => {
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      };

      // Actualizar period balances
      balance.period_debit_bs =
        safeNumber(balance.period_debit_bs) + safeNumber(totals.debit_bs);
      balance.period_credit_bs =
        safeNumber(balance.period_credit_bs) + safeNumber(totals.credit_bs);
      balance.period_debit_usd =
        safeNumber(balance.period_debit_usd) + safeNumber(totals.debit_usd);
      balance.period_credit_usd =
        safeNumber(balance.period_credit_usd) + safeNumber(totals.credit_usd);

      // Calcular closing balances (asegurando valores numéricos seguros)
      const openingDebitBs = safeNumber(balance.opening_balance_debit_bs);
      const openingCreditBs = safeNumber(balance.opening_balance_credit_bs);
      const openingDebitUsd = safeNumber(balance.opening_balance_debit_usd);
      const openingCreditUsd = safeNumber(balance.opening_balance_credit_usd);

      balance.closing_balance_debit_bs =
        openingDebitBs + safeNumber(balance.period_debit_bs);
      balance.closing_balance_credit_bs =
        openingCreditBs + safeNumber(balance.period_credit_bs);
      balance.closing_balance_debit_usd =
        openingDebitUsd + safeNumber(balance.period_debit_usd);
      balance.closing_balance_credit_usd =
        openingCreditUsd + safeNumber(balance.period_credit_usd);

      balance.last_calculated_at = new Date();
      balancesToSave.push(balance);
    }

    // ⚡ OPTIMIZACIÓN: Batch save
    if (balancesToSave.length > 0) {
      await this.balanceRepository.save(balancesToSave);
    }
  }
}
