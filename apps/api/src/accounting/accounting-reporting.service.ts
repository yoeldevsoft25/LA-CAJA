import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { Debt } from '../database/entities/debt.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
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
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(FiscalInvoice)
    private fiscalInvoiceRepository: Repository<FiscalInvoice>,
    private sharedService: AccountingSharedService,
  ) { }

  /**
   * Libro de Ventas (SENIAT)
   */
  async getVATSalesBook(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    entries: Array<{
      date: Date;
      invoice_number: string;
      control_number: string;
      customer_name: string;
      customer_tax_id: string;
      total_sales: number;
      exempt_sales: number;
      taxable_base: number;
      tax_amount: number;
      tax_rate: number;
      status: string;
    }>;
    summary: {
      total_sales: number;
      total_exempt: number;
      total_taxable: number;
      total_tax: number;
    };
  }> {
    const invoices = await this.fiscalInvoiceRepository.find({
      where: {
        store_id: storeId,
        issued_at: Between(startDate, endDate),
        // status: In(['issued', 'cancelled']), // Incluir anuladas para el libro
      },
      order: { issued_at: 'ASC', invoice_number: 'ASC' },
      relations: ['customer'],
    });

    const entries = invoices.map((inv) => {
      // Si está anulada, mostrar montos en 0 pero listar la factura
      const isCancelled = inv.status === 'cancelled';
      const total = isCancelled ? 0 : Number(inv.total_bs);
      const tax = isCancelled ? 0 : Number(inv.tax_amount_bs);
      const base = isCancelled ? 0 : Number(inv.subtotal_bs);
      const exempt = isCancelled ? 0 : (Number(inv.tax_rate) === 0 ? Number(inv.total_bs) : 0);
      // Si la tasa es > 0, base es subtotal. Si es 0, base es 0 (todo es exento)
      const taxableBase = Number(inv.tax_rate) > 0 ? base : 0;

      return {
        date: inv.issued_at || inv.created_at,
        invoice_number: inv.invoice_number,
        control_number: inv.fiscal_control_code || 'N/A',
        customer_name: inv.customer_name || 'Cliente Genérico',
        customer_tax_id: inv.customer_tax_id || 'N/A',
        total_sales: total,
        exempt_sales: exempt,
        taxable_base: taxableBase,
        tax_amount: tax,
        tax_rate: Number(inv.tax_rate),
        status: inv.status,
      };
    });

    const summary = entries.reduce(
      (acc, curr) => ({
        total_sales: acc.total_sales + curr.total_sales,
        total_exempt: acc.total_exempt + curr.exempt_sales,
        total_taxable: acc.total_taxable + curr.taxable_base,
        total_tax: acc.total_tax + curr.tax_amount,
      }),
      { total_sales: 0, total_exempt: 0, total_taxable: 0, total_tax: 0 },
    );

    return { entries, summary };
  }

  /**
   * Libro de Compras (SENIAT)
   * Basado en Asientos de Compra y Gastos con desglose de impuestos
   */
  async getVATPurchasesBook(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    entries: Array<{
      date: Date;
      invoice_number: string;
      control_number: string;
      supplier_name: string;
      supplier_tax_id: string;
      total_purchases: number;
      exempt_purchases: number;
      taxable_base: number;
      tax_amount: number;
      tax_rate: number;
    }>;
    summary: {
      total_purchases: number;
      total_exempt: number;
      total_taxable: number;
      total_tax: number;
    };
  }> {
    // Buscar asientos de tipo 'purchase', 'expense', o manuales que tengan metadata de factura
    const entries = await this.journalEntryRepository.find({
      where: {
        store_id: storeId,
        entry_date: Between(startDate, endDate),
        // Podríamos filtrar por source_type, pero mejor traer todo lo que parezca compra
      },
      relations: ['lines'],
      order: { entry_date: 'ASC' },
    });

    // Filtrar en memoria aquellos que parecen ser compras con factura
    // Criterio: Tienen metadata.invoice_number O son source_type='purchase_order'
    // PERO: Si vienen de PO automática, no tienen tax (por ahora). Mostrarlas como exentas.

    // Lista de cuentas de crédito fiscal (Input VAT)
    // En una implementación real, buscaríamos por configuración. 
    // Por ahora, asumimos cuentas que empiecen con '1.01.05' (Activo Corriente -> Impuestos)
    // O buscamos líneas con tax_code definido.

    const bookEntries: Array<{
      date: Date;
      invoice_number: string;
      control_number: string;
      supplier_name: string;
      supplier_tax_id: string;
      total_purchases: number;
      exempt_purchases: number;
      taxable_base: number;
      tax_amount: number;
      tax_rate: number;
    }> = [];

    for (const entry of entries) {
      // Intentar extraer datos de factura de metadata
      const invoiceNumber = entry.metadata?.invoice_number || entry.reference_number || 'N/A';
      const controlNumber = entry.metadata?.control_number || 'N/A';
      const supplierName = entry.metadata?.supplier_name || entry.description || 'Proveedor';
      const supplierTaxId = entry.metadata?.supplier_tax_id || 'N/A';

      // Si no es una entrada de compra/gasto explícita y no tiene info de factura, saltar
      // Excepto si es una PO, que sabemos es compra
      if (!['purchase', 'expense'].includes(entry.entry_type) && !entry.metadata?.invoice_number) {
        continue;
      }

      let taxAmount = 0;
      let taxableBase = 0;
      let exemptAmount = 0;
      let totalAmount = 0;

      // Calcular montos desde las líneas
      // Buscamos líneas que incrementen el pasivo (Haber/Credit en CxP) -> Total Compra
      // O sumamos líneas de Gasto/Activo (Debe/Debit) -> Base + Impuesto

      // Enfoque: Sumar Debitos (Gasto + Tax).
      // Identificar Tax por account_code, tax_code, o descripción.

      for (const line of entry.lines) {
        const debit = Number(line.debit_amount_bs);
        if (debit > 0) {
          // Heurística simple: si tiene tax_code o nombre dice "IVA Crédito", es impuesto
          const isTax = line.tax_code || line.account_name.toLowerCase().includes('iva crédito') || line.account_name.toLowerCase().includes('fiscal credit');

          if (isTax) {
            taxAmount += debit;
          } else {
            // Es base o exento.
            // Si hay taxAmount en el asiento, asumimos que esto es base.
            // Pero es difícil saber qué línea es base de qué impuesto si hay múltiples.
            // Simplificamos: acumulamos en "Potential Base".
            taxableBase += debit;
          }
        }
      }

      // Ajuste: Si taxAmount > 0, entonces taxableBase es realmente base imponible.
      // Si taxAmount == 0, todo lo que sumamos es Exento.
      if (taxAmount === 0) {
        exemptAmount = taxableBase;
        taxableBase = 0;
      }

      totalAmount = exemptAmount + taxableBase + taxAmount;

      // Calcular tasa implícita
      const rate = taxableBase > 0 ? (taxAmount / taxableBase) * 100 : 0;

      bookEntries.push({
        date: entry.entry_date,
        invoice_number: invoiceNumber,
        control_number: controlNumber,
        supplier_name: supplierName,
        supplier_tax_id: supplierTaxId,
        total_purchases: totalAmount,
        exempt_purchases: exemptAmount,
        taxable_base: taxableBase,
        tax_amount: taxAmount,
        tax_rate: rate
      });
    }

    const summary = bookEntries.reduce(
      (acc, curr) => ({
        total_purchases: acc.total_purchases + curr.total_purchases,
        total_exempt: acc.total_exempt + curr.exempt_purchases,
        total_taxable: acc.total_taxable + curr.taxable_base,
        total_tax: acc.total_tax + curr.tax_amount,
      }),
      { total_purchases: 0, total_exempt: 0, total_taxable: 0, total_tax: 0 },
    );

    return { entries: bookEntries, summary };
  }
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
        .andWhere('entry.source_type != :sourceType', { sourceType: 'period_close' })
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

  /**
   * Aging de Cuentas por Cobrar (Accounts Receivable Aging)
   * Agrupa deudas pendientes por antigüedad: Corriente, 1-30, 31-60, 61-90, 90+ días
   */
  async getAccountsReceivableAging(
    storeId: string,
    asOfDate: Date = new Date(),
  ): Promise<{
    customers: Array<{
      customer_id: string;
      customer_name: string;
      current_bs: number;
      current_usd: number;
      days_1_30_bs: number;
      days_1_30_usd: number;
      days_31_60_bs: number;
      days_31_60_usd: number;
      days_61_90_bs: number;
      days_61_90_usd: number;
      days_over_90_bs: number;
      days_over_90_usd: number;
      total_bs: number;
      total_usd: number;
    }>;
    totals: {
      current_bs: number;
      current_usd: number;
      days_1_30_bs: number;
      days_1_30_usd: number;
      days_31_60_bs: number;
      days_31_60_usd: number;
      days_61_90_bs: number;
      days_61_90_usd: number;
      days_over_90_bs: number;
      days_over_90_usd: number;
      total_bs: number;
      total_usd: number;
    };
  }> {
    // Obtener todas las deudas abiertas/parciales con sus pagos y cliente
    const debts = await this.debtRepository.find({
      where: {
        store_id: storeId,
        status: In(['open', 'partial']),
      },
      relations: ['customer', 'payments'],
    });

    // Agrupar por cliente
    const customerMap = new Map<
      string,
      {
        customer_id: string;
        customer_name: string;
        current_bs: number;
        current_usd: number;
        days_1_30_bs: number;
        days_1_30_usd: number;
        days_31_60_bs: number;
        days_31_60_usd: number;
        days_61_90_bs: number;
        days_61_90_usd: number;
        days_over_90_bs: number;
        days_over_90_usd: number;
        total_bs: number;
        total_usd: number;
      }
    >();

    for (const debt of debts) {
      // Calcular saldo pendiente (monto - pagos)
      const totalPaidBs = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_bs || 0),
        0,
      );
      const totalPaidUsd = (debt.payments || []).reduce(
        (sum, p) => sum + Number(p.amount_usd || 0),
        0,
      );
      const outstandingBs = Number(debt.amount_bs) - totalPaidBs;
      const outstandingUsd = Number(debt.amount_usd) - totalPaidUsd;

      if (outstandingBs <= 0.01 && outstandingUsd <= 0.01) continue;

      // Calcular antigüedad en días
      const daysSinceCreation = Math.floor(
        (asOfDate.getTime() - new Date(debt.created_at).getTime()) /
        (1000 * 60 * 60 * 24),
      );

      // Obtener o crear registro del cliente
      if (!customerMap.has(debt.customer_id)) {
        customerMap.set(debt.customer_id, {
          customer_id: debt.customer_id,
          customer_name:
            debt.customer?.name || 'Sin nombre',
          current_bs: 0,
          current_usd: 0,
          days_1_30_bs: 0,
          days_1_30_usd: 0,
          days_31_60_bs: 0,
          days_31_60_usd: 0,
          days_61_90_bs: 0,
          days_61_90_usd: 0,
          days_over_90_bs: 0,
          days_over_90_usd: 0,
          total_bs: 0,
          total_usd: 0,
        });
      }

      const record = customerMap.get(debt.customer_id)!;

      // Clasificar por antigüedad
      if (daysSinceCreation <= 0) {
        record.current_bs += outstandingBs;
        record.current_usd += outstandingUsd;
      } else if (daysSinceCreation <= 30) {
        record.days_1_30_bs += outstandingBs;
        record.days_1_30_usd += outstandingUsd;
      } else if (daysSinceCreation <= 60) {
        record.days_31_60_bs += outstandingBs;
        record.days_31_60_usd += outstandingUsd;
      } else if (daysSinceCreation <= 90) {
        record.days_61_90_bs += outstandingBs;
        record.days_61_90_usd += outstandingUsd;
      } else {
        record.days_over_90_bs += outstandingBs;
        record.days_over_90_usd += outstandingUsd;
      }

      record.total_bs += outstandingBs;
      record.total_usd += outstandingUsd;
    }

    const customers = Array.from(customerMap.values()).sort(
      (a, b) => b.total_bs - a.total_bs,
    );

    // Calcular totales
    const totals = customers.reduce(
      (acc, c) => ({
        current_bs: acc.current_bs + c.current_bs,
        current_usd: acc.current_usd + c.current_usd,
        days_1_30_bs: acc.days_1_30_bs + c.days_1_30_bs,
        days_1_30_usd: acc.days_1_30_usd + c.days_1_30_usd,
        days_31_60_bs: acc.days_31_60_bs + c.days_31_60_bs,
        days_31_60_usd: acc.days_31_60_usd + c.days_31_60_usd,
        days_61_90_bs: acc.days_61_90_bs + c.days_61_90_bs,
        days_61_90_usd: acc.days_61_90_usd + c.days_61_90_usd,
        days_over_90_bs: acc.days_over_90_bs + c.days_over_90_bs,
        days_over_90_usd: acc.days_over_90_usd + c.days_over_90_usd,
        total_bs: acc.total_bs + c.total_bs,
        total_usd: acc.total_usd + c.total_usd,
      }),
      {
        current_bs: 0,
        current_usd: 0,
        days_1_30_bs: 0,
        days_1_30_usd: 0,
        days_31_60_bs: 0,
        days_31_60_usd: 0,
        days_61_90_bs: 0,
        days_61_90_usd: 0,
        days_over_90_bs: 0,
        days_over_90_usd: 0,
        total_bs: 0,
        total_usd: 0,
      },
    );

    return { customers, totals };
  }

  /**
   * Aging de Cuentas por Pagar (Accounts Payable Aging)
   * Agrupa órdenes de compra pendientes por antigüedad
   */
  async getAccountsPayableAging(
    storeId: string,
    asOfDate: Date = new Date(),
  ): Promise<{
    suppliers: Array<{
      supplier_id: string;
      supplier_name: string;
      current_bs: number;
      current_usd: number;
      days_1_30_bs: number;
      days_1_30_usd: number;
      days_31_60_bs: number;
      days_31_60_usd: number;
      days_61_90_bs: number;
      days_61_90_usd: number;
      days_over_90_bs: number;
      days_over_90_usd: number;
      total_bs: number;
      total_usd: number;
    }>;
    totals: {
      current_bs: number;
      current_usd: number;
      days_1_30_bs: number;
      days_1_30_usd: number;
      days_31_60_bs: number;
      days_31_60_usd: number;
      days_61_90_bs: number;
      days_61_90_usd: number;
      days_over_90_bs: number;
      days_over_90_usd: number;
      total_bs: number;
      total_usd: number;
    };
  }> {
    // Obtener órdenes de compra pendientes (no completadas ni canceladas)
    const orders = await this.purchaseOrderRepository.find({
      where: {
        store_id: storeId,
        status: In(['draft', 'sent', 'confirmed', 'partial']),
      },
      relations: ['supplier'],
    });

    // Agrupar por proveedor
    const supplierMap = new Map<
      string,
      {
        supplier_id: string;
        supplier_name: string;
        current_bs: number;
        current_usd: number;
        days_1_30_bs: number;
        days_1_30_usd: number;
        days_31_60_bs: number;
        days_31_60_usd: number;
        days_61_90_bs: number;
        days_61_90_usd: number;
        days_over_90_bs: number;
        days_over_90_usd: number;
        total_bs: number;
        total_usd: number;
      }
    >();

    for (const order of orders) {
      const amountBs = Number(order.total_amount_bs || 0);
      const amountUsd = Number(order.total_amount_usd || 0);

      if (amountBs <= 0.01 && amountUsd <= 0.01) continue;

      const daysSinceCreation = Math.floor(
        (asOfDate.getTime() - new Date(order.created_at).getTime()) /
        (1000 * 60 * 60 * 24),
      );

      if (!supplierMap.has(order.supplier_id)) {
        supplierMap.set(order.supplier_id, {
          supplier_id: order.supplier_id,
          supplier_name: order.supplier?.name || 'Sin nombre',
          current_bs: 0,
          current_usd: 0,
          days_1_30_bs: 0,
          days_1_30_usd: 0,
          days_31_60_bs: 0,
          days_31_60_usd: 0,
          days_61_90_bs: 0,
          days_61_90_usd: 0,
          days_over_90_bs: 0,
          days_over_90_usd: 0,
          total_bs: 0,
          total_usd: 0,
        });
      }

      const record = supplierMap.get(order.supplier_id)!;

      if (daysSinceCreation <= 0) {
        record.current_bs += amountBs;
        record.current_usd += amountUsd;
      } else if (daysSinceCreation <= 30) {
        record.days_1_30_bs += amountBs;
        record.days_1_30_usd += amountUsd;
      } else if (daysSinceCreation <= 60) {
        record.days_31_60_bs += amountBs;
        record.days_31_60_usd += amountUsd;
      } else if (daysSinceCreation <= 90) {
        record.days_61_90_bs += amountBs;
        record.days_61_90_usd += amountUsd;
      } else {
        record.days_over_90_bs += amountBs;
        record.days_over_90_usd += amountUsd;
      }

      record.total_bs += amountBs;
      record.total_usd += amountUsd;
    }

    const suppliers = Array.from(supplierMap.values()).sort(
      (a, b) => b.total_bs - a.total_bs,
    );

    const totals = suppliers.reduce(
      (acc, s) => ({
        current_bs: acc.current_bs + s.current_bs,
        current_usd: acc.current_usd + s.current_usd,
        days_1_30_bs: acc.days_1_30_bs + s.days_1_30_bs,
        days_1_30_usd: acc.days_1_30_usd + s.days_1_30_usd,
        days_31_60_bs: acc.days_31_60_bs + s.days_31_60_bs,
        days_31_60_usd: acc.days_31_60_usd + s.days_31_60_usd,
        days_61_90_bs: acc.days_61_90_bs + s.days_61_90_bs,
        days_61_90_usd: acc.days_61_90_usd + s.days_61_90_usd,
        days_over_90_bs: acc.days_over_90_bs + s.days_over_90_bs,
        days_over_90_usd: acc.days_over_90_usd + s.days_over_90_usd,
        total_bs: acc.total_bs + s.total_bs,
        total_usd: acc.total_usd + s.total_usd,
      }),
      {
        current_bs: 0,
        current_usd: 0,
        days_1_30_bs: 0,
        days_1_30_usd: 0,
        days_31_60_bs: 0,
        days_31_60_usd: 0,
        days_61_90_bs: 0,
        days_61_90_usd: 0,
        days_over_90_bs: 0,
        days_over_90_usd: 0,
        total_bs: 0,
        total_usd: 0,
      },
    );

    return { suppliers, totals };
  }
}
