import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { AccountingSharedService } from './accounting-shared.service';

/**
 * AccountingReportingService
 *
 * Servicio especializado para generación de reportes financieros.
 * Extraído de AccountingService para mejorar separación de responsabilidades.
 */
@Injectable()
export class AccountingReportingService {
  private readonly logger = new Logger(AccountingReportingService.name);

  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private journalEntryLineRepository: Repository<JournalEntryLine>,
    @InjectRepository(ChartOfAccount)
    private accountRepository: Repository<ChartOfAccount>,
    private sharedService: AccountingSharedService,
  ) {}

  /**
   * Generar Balance General
   */
  async getBalanceSheet(
    storeId: string,
    asOfDate: Date = new Date(),
  ): Promise<{
    assets: Array<{
      account_code: string;
      account_name: string;
      balance_bs: number;
      balance_usd: number;
    }>;
    liabilities: Array<{
      account_code: string;
      account_name: string;
      balance_bs: number;
      balance_usd: number;
    }>;
    equity: Array<{
      account_code: string;
      account_name: string;
      balance_bs: number;
      balance_usd: number;
    }>;
    totals: {
      total_assets_bs: number;
      total_assets_usd: number;
      total_liabilities_bs: number;
      total_liabilities_usd: number;
      total_equity_bs: number;
      total_equity_usd: number;
    };
  }> {
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.store_id = :storeId', { storeId })
      .andWhere('account.is_active = :active', { active: true })
      .andWhere('account.account_type IN (:...types)', {
        types: ['asset', 'liability', 'equity'],
      })
      .orderBy('account.account_code', 'ASC')
      .getMany();

    const assets: Array<{
      account_code: string;
      account_name: string;
      balance_bs: number;
      balance_usd: number;
    }> = [];
    const liabilities: Array<{
      account_code: string;
      account_name: string;
      balance_bs: number;
      balance_usd: number;
    }> = [];
    const equity: Array<{
      account_code: string;
      account_name: string;
      balance_bs: number;
      balance_usd: number;
    }> = [];

    // Optimización: Calcular todos los balances en batch (evita N+1 queries)
    const accountIds = accounts.map((a) => a.id);
    const balancesMap = await this.sharedService.calculateAccountBalancesBatch(
      storeId,
      accountIds,
      asOfDate,
    );

    for (const account of accounts) {
      const balance = balancesMap.get(account.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };

      if (
        Math.abs(balance.balance_bs) < 0.01 &&
        Math.abs(balance.balance_usd) < 0.01
      ) {
        continue; // Omitir cuentas con saldo cero
      }

      const accountData = {
        account_code: account.account_code,
        account_name: account.account_name,
        balance_bs: balance.balance_bs,
        balance_usd: balance.balance_usd,
      };

      if (account.account_type === 'asset') {
        assets.push(accountData);
      } else if (account.account_type === 'liability') {
        liabilities.push(accountData);
      } else if (account.account_type === 'equity') {
        equity.push(accountData);
      }
    }

    const totalAssetsBs = assets.reduce((sum, a) => sum + a.balance_bs, 0);
    const totalAssetsUsd = assets.reduce((sum, a) => sum + a.balance_usd, 0);
    const totalLiabilitiesBs = liabilities.reduce(
      (sum, l) => sum + l.balance_bs,
      0,
    );
    const totalLiabilitiesUsd = liabilities.reduce(
      (sum, l) => sum + l.balance_usd,
      0,
    );
    const totalEquityBs = equity.reduce((sum, e) => sum + e.balance_bs, 0);
    const totalEquityUsd = equity.reduce((sum, e) => sum + e.balance_usd, 0);

    return {
      assets,
      liabilities,
      equity,
      totals: {
        total_assets_bs: totalAssetsBs,
        total_assets_usd: totalAssetsUsd,
        total_liabilities_bs: totalLiabilitiesBs,
        total_liabilities_usd: totalLiabilitiesUsd,
        total_equity_bs: totalEquityBs,
        total_equity_usd: totalEquityUsd,
      },
    };
  }

  /**
   * Generar Estado de Resultados (Pérdidas y Ganancias)
   */
  async getIncomeStatement(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    revenues: Array<{
      account_code: string;
      account_name: string;
      amount_bs: number;
      amount_usd: number;
    }>;
    expenses: Array<{
      account_code: string;
      account_name: string;
      amount_bs: number;
      amount_usd: number;
    }>;
    totals: {
      total_revenue_bs: number;
      total_revenue_usd: number;
      total_expenses_bs: number;
      total_expenses_usd: number;
      net_income_bs: number;
      net_income_usd: number;
    };
  }> {
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.store_id = :storeId', { storeId })
      .andWhere('account.is_active = :active', { active: true })
      .andWhere('account.account_type IN (:...types)', {
        types: ['revenue', 'expense'],
      })
      .orderBy('account.account_code', 'ASC')
      .getMany();

    const revenues: Array<{
      account_code: string;
      account_name: string;
      amount_bs: number;
      amount_usd: number;
    }> = [];
    const expenses: Array<{
      account_code: string;
      account_name: string;
      amount_bs: number;
      amount_usd: number;
    }> = [];

    for (const account of accounts) {
      // Obtener movimientos del período
      const entries = await this.journalEntryRepository
        .createQueryBuilder('entry')
        .innerJoin('entry.lines', 'line')
        .where('entry.store_id = :storeId', { storeId })
        .andWhere('line.account_id = :accountId', { accountId: account.id })
        .andWhere('entry.status = :status', { status: 'posted' })
        .andWhere('entry.entry_date >= :startDate', { startDate })
        .andWhere('entry.entry_date <= :endDate', { endDate })
        .select('SUM(line.debit_amount_bs)', 'total_debit_bs')
        .addSelect('SUM(line.credit_amount_bs)', 'total_credit_bs')
        .addSelect('SUM(line.debit_amount_usd)', 'total_debit_usd')
        .addSelect('SUM(line.credit_amount_usd)', 'total_credit_usd')
        .getRawOne();

      const totalDebitBs = Number(entries?.total_debit_bs || 0);
      const totalCreditBs = Number(entries?.total_credit_bs || 0);
      const totalDebitUsd = Number(entries?.total_debit_usd || 0);
      const totalCreditUsd = Number(entries?.total_credit_usd || 0);

      // Para ingresos: crédito - débito
      // Para gastos: débito - crédito
      let amountBs = 0;
      let amountUsd = 0;

      if (account.account_type === 'revenue') {
        amountBs = totalCreditBs - totalDebitBs;
        amountUsd = totalCreditUsd - totalDebitUsd;
      } else {
        amountBs = totalDebitBs - totalCreditBs;
        amountUsd = totalDebitUsd - totalCreditUsd;
      }

      if (Math.abs(amountBs) < 0.01 && Math.abs(amountUsd) < 0.01) {
        continue; // Omitir cuentas sin movimiento
      }

      const accountData = {
        account_code: account.account_code,
        account_name: account.account_name,
        amount_bs: amountBs,
        amount_usd: amountUsd,
      };

      if (account.account_type === 'revenue') {
        revenues.push(accountData);
      } else {
        expenses.push(accountData);
      }
    }

    const totalRevenueBs = revenues.reduce((sum, r) => sum + r.amount_bs, 0);
    const totalRevenueUsd = revenues.reduce((sum, r) => sum + r.amount_usd, 0);
    const totalExpensesBs = expenses.reduce((sum, e) => sum + e.amount_bs, 0);
    const totalExpensesUsd = expenses.reduce((sum, e) => sum + e.amount_usd, 0);
    const netIncomeBs = totalRevenueBs - totalExpensesBs;
    const netIncomeUsd = totalRevenueUsd - totalExpensesUsd;

    return {
      revenues,
      expenses,
      totals: {
        total_revenue_bs: totalRevenueBs,
        total_revenue_usd: totalRevenueUsd,
        total_expenses_bs: totalExpensesBs,
        total_expenses_usd: totalExpensesUsd,
        net_income_bs: netIncomeBs,
        net_income_usd: netIncomeUsd,
      },
    };
  }

  /**
   * Generar Trial Balance (Balance de Comprobación)
   */
  async getTrialBalance(
    storeId: string,
    asOfDate: Date = new Date(),
    includeZeroBalance: boolean = false,
  ): Promise<{
    accounts: Array<{
      account_code: string;
      account_name: string;
      account_type: string;
      debit_balance_bs: number;
      credit_balance_bs: number;
      debit_balance_usd: number;
      credit_balance_usd: number;
    }>;
    totals: {
      total_debits_bs: number;
      total_credits_bs: number;
      total_debits_usd: number;
      total_credits_usd: number;
      is_balanced: boolean;
      difference_bs: number;
      difference_usd: number;
    };
    unposted_entries_count: number;
  }> {
    // Obtener todas las cuentas activas
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.store_id = :storeId', { storeId })
      .andWhere('account.is_active = :active', { active: true })
      .orderBy('account.account_code', 'ASC')
      .getMany();

    // Contar asientos sin postear
    const unpostedCount = await this.journalEntryRepository.count({
      where: {
        store_id: storeId,
        status: 'draft',
        entry_date: Between(new Date(0), asOfDate),
      },
    });

    const trialBalanceAccounts: Array<{
      account_code: string;
      account_name: string;
      account_type: string;
      debit_balance_bs: number;
      credit_balance_bs: number;
      debit_balance_usd: number;
      credit_balance_usd: number;
    }> = [];

    for (const account of accounts) {
      // Calcular totales de débito y crédito para esta cuenta
      const lines = await this.journalEntryLineRepository
        .createQueryBuilder('line')
        .innerJoin('line.entry', 'entry')
        .where('entry.store_id = :storeId', { storeId })
        .andWhere('line.account_id = :accountId', { accountId: account.id })
        .andWhere('entry.status = :status', { status: 'posted' })
        .andWhere('entry.entry_date <= :asOfDate', { asOfDate })
        .select('SUM(line.debit_amount_bs)', 'total_debit_bs')
        .addSelect('SUM(line.credit_amount_bs)', 'total_credit_bs')
        .addSelect('SUM(line.debit_amount_usd)', 'total_debit_usd')
        .addSelect('SUM(line.credit_amount_usd)', 'total_credit_usd')
        .getRawOne();

      const totalDebitBs = Number(lines?.total_debit_bs || 0);
      const totalCreditBs = Number(lines?.total_credit_bs || 0);
      const totalDebitUsd = Number(lines?.total_debit_usd || 0);
      const totalCreditUsd = Number(lines?.total_credit_usd || 0);

      // Determinar saldo deudor o acreedor según tipo de cuenta
      let debitBalanceBs = 0;
      let creditBalanceBs = 0;
      let debitBalanceUsd = 0;
      let creditBalanceUsd = 0;

      if (
        account.account_type === 'asset' ||
        account.account_type === 'expense'
      ) {
        // Activos y gastos: saldo deudor (débito - crédito)
        const netBalanceBs = totalDebitBs - totalCreditBs;
        const netBalanceUsd = totalDebitUsd - totalCreditUsd;
        if (netBalanceBs > 0) {
          debitBalanceBs = netBalanceBs;
        } else {
          creditBalanceBs = Math.abs(netBalanceBs);
        }
        if (netBalanceUsd > 0) {
          debitBalanceUsd = netBalanceUsd;
        } else {
          creditBalanceUsd = Math.abs(netBalanceUsd);
        }
      } else {
        // Pasivos, patrimonio e ingresos: saldo acreedor (crédito - débito)
        const netBalanceBs = totalCreditBs - totalDebitBs;
        const netBalanceUsd = totalCreditUsd - totalDebitUsd;
        if (netBalanceBs > 0) {
          creditBalanceBs = netBalanceBs;
        } else {
          debitBalanceBs = Math.abs(netBalanceBs);
        }
        if (netBalanceUsd > 0) {
          creditBalanceUsd = netBalanceUsd;
        } else {
          debitBalanceUsd = Math.abs(netBalanceUsd);
        }
      }

      // Omitir cuentas con saldo cero si no se incluyen
      if (!includeZeroBalance) {
        if (
          Math.abs(debitBalanceBs) < 0.01 &&
          Math.abs(creditBalanceBs) < 0.01 &&
          Math.abs(debitBalanceUsd) < 0.01 &&
          Math.abs(creditBalanceUsd) < 0.01
        ) {
          continue;
        }
      }

      trialBalanceAccounts.push({
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        debit_balance_bs: debitBalanceBs,
        credit_balance_bs: creditBalanceBs,
        debit_balance_usd: debitBalanceUsd,
        credit_balance_usd: creditBalanceUsd,
      });
    }

    // Calcular totales
    const totalDebitsBs = trialBalanceAccounts.reduce(
      (sum, a) => sum + a.debit_balance_bs,
      0,
    );
    const totalCreditsBs = trialBalanceAccounts.reduce(
      (sum, a) => sum + a.credit_balance_bs,
      0,
    );
    const totalDebitsUsd = trialBalanceAccounts.reduce(
      (sum, a) => sum + a.debit_balance_usd,
      0,
    );
    const totalCreditsUsd = trialBalanceAccounts.reduce(
      (sum, a) => sum + a.credit_balance_usd,
      0,
    );

    const differenceBs = Math.abs(totalDebitsBs - totalCreditsBs);
    const differenceUsd = Math.abs(totalDebitsUsd - totalCreditsUsd);
    const isBalanced = differenceBs < 0.01 && differenceUsd < 0.01;

    return {
      accounts: trialBalanceAccounts,
      totals: {
        total_debits_bs: totalDebitsBs,
        total_credits_bs: totalCreditsBs,
        total_debits_usd: totalDebitsUsd,
        total_credits_usd: totalCreditsUsd,
        is_balanced: isBalanced,
        difference_bs: differenceBs,
        difference_usd: differenceUsd,
      },
      unposted_entries_count: unpostedCount,
    };
  }

  /**
   * Generar Libro Mayor (General Ledger)
   */
  async getGeneralLedger(
    storeId: string,
    startDate: Date,
    endDate: Date,
    accountIds?: string[],
  ): Promise<{
    accounts: Array<{
      account_id: string;
      account_code: string;
      account_name: string;
      account_type: string;
      opening_balance_bs: number;
      opening_balance_usd: number;
      movements: Array<{
        entry_id: string;
        entry_number: string;
        entry_date: string;
        description: string;
        reference_number: string | null;
        debit_amount_bs: number;
        credit_amount_bs: number;
        debit_amount_usd: number;
        credit_amount_usd: number;
        running_balance_bs: number;
        running_balance_usd: number;
      }>;
      closing_balance_bs: number;
      closing_balance_usd: number;
      total_debits_bs: number;
      total_credits_bs: number;
      total_debits_usd: number;
      total_credits_usd: number;
    }>;
  }> {
    // Obtener cuentas a incluir
    const accountsQuery = this.accountRepository
      .createQueryBuilder('account')
      .where('account.store_id = :storeId', { storeId })
      .andWhere('account.is_active = :active', { active: true });

    if (accountIds && accountIds.length > 0) {
      accountsQuery.andWhere('account.id IN (:...accountIds)', { accountIds });
    }

    const accounts = await accountsQuery
      .orderBy('account.account_code', 'ASC')
      .getMany();

    const ledgerAccounts: Array<{
      account_id: string;
      account_code: string;
      account_name: string;
      account_type: string;
      opening_balance_bs: number;
      opening_balance_usd: number;
      movements: Array<{
        entry_id: string;
        entry_number: string;
        entry_date: string;
        description: string;
        reference_number: string | null;
        debit_amount_bs: number;
        credit_amount_bs: number;
        debit_amount_usd: number;
        credit_amount_usd: number;
        running_balance_bs: number;
        running_balance_usd: number;
      }>;
      closing_balance_bs: number;
      closing_balance_usd: number;
      total_debits_bs: number;
      total_credits_bs: number;
      total_debits_usd: number;
      total_credits_usd: number;
    }> = [];

    // Optimización: Calcular todos los balances iniciales en batch (evita N+1 queries)
    const accountIdList = accounts.map((a) => a.id);
    const openingBalances =
      await this.sharedService.calculateAccountBalancesBatch(
        storeId,
        accountIdList,
        startDate,
      );

    for (const account of accounts) {
      // Obtener saldo inicial del Map (ya calculado en batch)
      const openingBalance = openingBalances.get(account.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };

      // Obtener movimientos en el período
      const movementsQuery = this.journalEntryLineRepository
        .createQueryBuilder('line')
        .innerJoin('line.entry', 'entry')
        .where('entry.store_id = :storeId', { storeId })
        .andWhere('line.account_id = :accountId', { accountId: account.id })
        .andWhere('entry.status = :status', { status: 'posted' })
        .andWhere('entry.entry_date >= :startDate', { startDate })
        .andWhere('entry.entry_date <= :endDate', { endDate })
        .select([
          'entry.id',
          'entry.entry_number',
          'entry.entry_date',
          'entry.description',
          'entry.reference_number',
          'line.debit_amount_bs',
          'line.credit_amount_bs',
          'line.debit_amount_usd',
          'line.credit_amount_usd',
        ])
        .orderBy('entry.entry_date', 'ASC')
        .addOrderBy('entry.entry_number', 'ASC');

      const lines = await movementsQuery.getRawMany();

      let runningBalanceBs = openingBalance.balance_bs;
      let runningBalanceUsd = openingBalance.balance_usd;
      let totalDebitsBs = 0;
      let totalCreditsBs = 0;
      let totalDebitsUsd = 0;
      let totalCreditsUsd = 0;

      const movements = lines.map((line) => {
        const debitBs = Number(line.line_debit_amount_bs || 0);
        const creditBs = Number(line.line_credit_amount_bs || 0);
        const debitUsd = Number(line.line_debit_amount_usd || 0);
        const creditUsd = Number(line.line_credit_amount_usd || 0);

        totalDebitsBs += debitBs;
        totalCreditsBs += creditBs;
        totalDebitsUsd += debitUsd;
        totalCreditsUsd += creditUsd;

        // Calcular saldo acumulado
        if (
          account.account_type === 'asset' ||
          account.account_type === 'expense'
        ) {
          runningBalanceBs = runningBalanceBs + debitBs - creditBs;
          runningBalanceUsd = runningBalanceUsd + debitUsd - creditUsd;
        } else {
          runningBalanceBs = runningBalanceBs + creditBs - debitBs;
          runningBalanceUsd = runningBalanceUsd + creditUsd - debitUsd;
        }

        return {
          entry_id: line.entry_id,
          entry_number: line.entry_entry_number,
          entry_date: line.entry_entry_date,
          description: line.entry_description || '',
          reference_number: line.entry_reference_number,
          debit_amount_bs: debitBs,
          credit_amount_bs: creditBs,
          debit_amount_usd: debitUsd,
          credit_amount_usd: creditUsd,
          running_balance_bs: runningBalanceBs,
          running_balance_usd: runningBalanceUsd,
        };
      });

      // Solo incluir cuentas con movimientos o saldo inicial
      if (
        movements.length > 0 ||
        Math.abs(openingBalance.balance_bs) > 0.01 ||
        Math.abs(openingBalance.balance_usd) > 0.01
      ) {
        ledgerAccounts.push({
          account_id: account.id,
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type,
          opening_balance_bs: openingBalance.balance_bs,
          opening_balance_usd: openingBalance.balance_usd,
          movements,
          closing_balance_bs: runningBalanceBs,
          closing_balance_usd: runningBalanceUsd,
          total_debits_bs: totalDebitsBs,
          total_credits_bs: totalCreditsBs,
          total_debits_usd: totalDebitsUsd,
          total_credits_usd: totalCreditsUsd,
        });
      }
    }

    return {
      accounts: ledgerAccounts,
    };
  }

  /**
   * Generar Estado de Flujo de Efectivo (Cash Flow Statement)
   */
  async getCashFlowStatement(
    storeId: string,
    startDate: Date,
    endDate: Date,
    getIncomeStatementFn: (
      storeId: string,
      startDate: Date,
      endDate: Date,
    ) => Promise<{
      totals: { net_income_bs: number; net_income_usd: number };
    }>,
  ): Promise<{
    operating_activities: {
      net_income_bs: number;
      net_income_usd: number;
      adjustments: Array<{
        description: string;
        amount_bs: number;
        amount_usd: number;
      }>;
      changes_in_working_capital: {
        accounts_receivable_bs: number;
        accounts_receivable_usd: number;
        accounts_payable_bs: number;
        accounts_payable_usd: number;
        inventory_bs: number;
        inventory_usd: number;
      };
      net_cash_from_operations_bs: number;
      net_cash_from_operations_usd: number;
    };
    investing_activities: Array<{
      description: string;
      amount_bs: number;
      amount_usd: number;
    }>;
    financing_activities: Array<{
      description: string;
      amount_bs: number;
      amount_usd: number;
    }>;
    net_change_in_cash_bs: number;
    net_change_in_cash_usd: number;
    cash_at_beginning_bs: number;
    cash_at_beginning_usd: number;
    cash_at_end_bs: number;
    cash_at_end_usd: number;
  }> {
    // Obtener resultado neto del Estado de Resultados
    const incomeStatement = await getIncomeStatementFn(
      storeId,
      startDate,
      endDate,
    );
    const netIncomeBs = incomeStatement.totals.net_income_bs;
    const netIncomeUsd = incomeStatement.totals.net_income_usd;

    // Calcular saldos de cuentas clave al inicio y fin del período
    const cashAccounts = await this.accountRepository.find({
      where: {
        store_id: storeId,
        is_active: true,
        account_code: In(['1.01.01', '1.01.02']), // Caja y Bancos
      },
    });

    const receivableAccount = await this.accountRepository.findOne({
      where: {
        store_id: storeId,
        is_active: true,
        account_code: '1.01.03', // Cuentas por Cobrar
      },
    });

    const payableAccount = await this.accountRepository.findOne({
      where: {
        store_id: storeId,
        is_active: true,
        account_code: '2.01.01', // Cuentas por Pagar
      },
    });

    const inventoryAccount = await this.accountRepository.findOne({
      where: {
        store_id: storeId,
        is_active: true,
        account_code: '1.02.01', // Inventario
      },
    });

    // Optimización: Calcular balances de cash accounts en batch
    const cashAccountIds = cashAccounts.map((a) => a.id);
    const cashBalancesStart =
      cashAccountIds.length > 0
        ? await this.sharedService.calculateAccountBalancesBatch(
            storeId,
            cashAccountIds,
            startDate,
          )
        : new Map();
    const cashBalancesEnd =
      cashAccountIds.length > 0
        ? await this.sharedService.calculateAccountBalancesBatch(
            storeId,
            cashAccountIds,
            endDate,
          )
        : new Map();

    // Calcular saldos al inicio del período
    let cashAtBeginningBs = 0;
    let cashAtBeginningUsd = 0;
    for (const account of cashAccounts) {
      const balance = cashBalancesStart.get(account.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      cashAtBeginningBs += balance.balance_bs;
      cashAtBeginningUsd += balance.balance_usd;
    }

    // Calcular saldos al fin del período
    let cashAtEndBs = 0;
    let cashAtEndUsd = 0;
    for (const account of cashAccounts) {
      const balance = cashBalancesEnd.get(account.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      cashAtEndBs += balance.balance_bs;
      cashAtEndUsd += balance.balance_usd;
    }

    // Calcular cambios en capital de trabajo
    let receivableChangeBs = 0;
    let receivableChangeUsd = 0;
    let payableChangeBs = 0;
    let payableChangeUsd = 0;
    let inventoryChangeBs = 0;
    let inventoryChangeUsd = 0;

    // Optimización: Calcular balances de cuentas especiales en batch
    const specialAccountIds: string[] = [];
    if (receivableAccount) specialAccountIds.push(receivableAccount.id);
    if (payableAccount) specialAccountIds.push(payableAccount.id);
    if (inventoryAccount) specialAccountIds.push(inventoryAccount.id);

    const specialBalancesStart =
      specialAccountIds.length > 0
        ? await this.sharedService.calculateAccountBalancesBatch(
            storeId,
            specialAccountIds,
            startDate,
          )
        : new Map();
    const specialBalancesEnd =
      specialAccountIds.length > 0
        ? await this.sharedService.calculateAccountBalancesBatch(
            storeId,
            specialAccountIds,
            endDate,
          )
        : new Map();

    if (receivableAccount) {
      const balanceStart = specialBalancesStart.get(receivableAccount.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      const balanceEnd = specialBalancesEnd.get(receivableAccount.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      receivableChangeBs = balanceEnd.balance_bs - balanceStart.balance_bs;
      receivableChangeUsd = balanceEnd.balance_usd - balanceStart.balance_usd;
    }

    if (payableAccount) {
      const balanceStart = specialBalancesStart.get(payableAccount.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      const balanceEnd = specialBalancesEnd.get(payableAccount.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      payableChangeBs = balanceEnd.balance_bs - balanceStart.balance_bs;
      payableChangeUsd = balanceEnd.balance_usd - balanceStart.balance_usd;
    }

    if (inventoryAccount) {
      const balanceStart = specialBalancesStart.get(inventoryAccount.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      const balanceEnd = specialBalancesEnd.get(inventoryAccount.id) || {
        balance_bs: 0,
        balance_usd: 0,
      };
      inventoryChangeBs = balanceEnd.balance_bs - balanceStart.balance_bs;
      inventoryChangeUsd = balanceEnd.balance_usd - balanceStart.balance_usd;
    }

    // Ajustes típicos (depreciación, etc.) - por ahora vacío, se puede expandir
    const adjustments: Array<{
      description: string;
      amount_bs: number;
      amount_usd: number;
    }> = [];

    // Calcular flujo de efectivo de operaciones (método indirecto)
    const netCashFromOperationsBs =
      netIncomeBs +
      adjustments.reduce((sum, adj) => sum + adj.amount_bs, 0) -
      receivableChangeBs +
      payableChangeBs -
      inventoryChangeBs;

    const netCashFromOperationsUsd =
      netIncomeUsd +
      adjustments.reduce((sum, adj) => sum + adj.amount_usd, 0) -
      receivableChangeUsd +
      payableChangeUsd -
      inventoryChangeUsd;

    // Actividades de inversión y financiamiento (vacío por ahora)
    const investingActivities: Array<{
      description: string;
      amount_bs: number;
      amount_usd: number;
    }> = [];

    const financingActivities: Array<{
      description: string;
      amount_bs: number;
      amount_usd: number;
    }> = [];

    const netCashFromInvestingBs = -investingActivities.reduce(
      (sum, inv) => sum + Math.abs(inv.amount_bs),
      0,
    );
    const netCashFromInvestingUsd = -investingActivities.reduce(
      (sum, inv) => sum + Math.abs(inv.amount_usd),
      0,
    );

    const netCashFromFinancingBs = financingActivities.reduce(
      (sum, fin) => sum + fin.amount_bs,
      0,
    );
    const netCashFromFinancingUsd = financingActivities.reduce(
      (sum, fin) => sum + fin.amount_usd,
      0,
    );

    const netChangeInCashBs =
      netCashFromOperationsBs + netCashFromInvestingBs + netCashFromFinancingBs;
    const netChangeInCashUsd =
      netCashFromOperationsUsd +
      netCashFromInvestingUsd +
      netCashFromFinancingUsd;

    return {
      operating_activities: {
        net_income_bs: netIncomeBs,
        net_income_usd: netIncomeUsd,
        adjustments,
        changes_in_working_capital: {
          accounts_receivable_bs: -receivableChangeBs,
          accounts_receivable_usd: -receivableChangeUsd,
          accounts_payable_bs: payableChangeBs,
          accounts_payable_usd: payableChangeUsd,
          inventory_bs: -inventoryChangeBs,
          inventory_usd: -inventoryChangeUsd,
        },
        net_cash_from_operations_bs: netCashFromOperationsBs,
        net_cash_from_operations_usd: netCashFromOperationsUsd,
      },
      investing_activities: investingActivities,
      financing_activities: financingActivities,
      net_change_in_cash_bs: netChangeInCashBs,
      net_change_in_cash_usd: netChangeInCashUsd,
      cash_at_beginning_bs: cashAtBeginningBs,
      cash_at_beginning_usd: cashAtBeginningUsd,
      cash_at_end_bs: cashAtEndBs,
      cash_at_end_usd: cashAtEndUsd,
    };
  }
}
