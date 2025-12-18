import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { JournalEntry, JournalEntryType, JournalEntryStatus } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { AccountingAccountMapping, TransactionType } from '../database/entities/accounting-account-mapping.entity';
import { AccountBalance } from '../database/entities/account-balance.entity';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GetJournalEntriesDto } from './dto/get-journal-entries.dto';
import { Sale } from '../database/entities/sale.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private journalEntryLineRepository: Repository<JournalEntryLine>,
    @InjectRepository(ChartOfAccount)
    private accountRepository: Repository<ChartOfAccount>,
    @InjectRepository(AccountingAccountMapping)
    private mappingRepository: Repository<AccountingAccountMapping>,
    @InjectRepository(AccountBalance)
    private balanceRepository: Repository<AccountBalance>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(PurchaseOrder)
    private purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(FiscalInvoice)
    private fiscalInvoiceRepository: Repository<FiscalInvoice>,
  ) {}

  /**
   * Generar número de asiento único
   */
  private async generateEntryNumber(storeId: string, entryDate: Date): Promise<string> {
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
      const lastSequence = parseInt(lastEntry.entry_number.split('-').pop() || '0', 10);
      sequence = lastSequence + 1;
    }

    return `AS-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Crear asiento contable manual
   */
  async createJournalEntry(
    storeId: string,
    dto: CreateJournalEntryDto,
    userId: string,
  ): Promise<JournalEntry> {
    // Validar que las líneas estén balanceadas
    const totalDebitBs = dto.lines.reduce((sum, line) => sum + line.debit_amount_bs, 0);
    const totalCreditBs = dto.lines.reduce((sum, line) => sum + line.credit_amount_bs, 0);
    const totalDebitUsd = dto.lines.reduce((sum, line) => sum + line.debit_amount_usd, 0);
    const totalCreditUsd = dto.lines.reduce((sum, line) => sum + line.credit_amount_usd, 0);

    if (Math.abs(totalDebitBs - totalCreditBs) > 0.01) {
      throw new BadRequestException('El asiento no está balanceado (BS)');
    }

    if (Math.abs(totalDebitUsd - totalCreditUsd) > 0.01) {
      throw new BadRequestException('El asiento no está balanceado (USD)');
    }

    // Validar que todas las cuentas existan
    for (const line of dto.lines) {
      const account = await this.accountRepository.findOne({
        where: { id: line.account_id, store_id: storeId },
      });

      if (!account) {
        throw new NotFoundException(`Cuenta ${line.account_code} no encontrada`);
      }

      if (!account.is_active) {
        throw new BadRequestException(`Cuenta ${line.account_code} está inactiva`);
      }

      if (!account.allows_entries) {
        throw new BadRequestException(`Cuenta ${line.account_code} no permite asientos directos`);
      }
    }

    const entryDate = new Date(dto.entry_date);
    const entryNumber = await this.generateEntryNumber(storeId, entryDate);

    const entry = this.journalEntryRepository.create({
      id: randomUUID(),
      store_id: storeId,
      entry_number: entryNumber,
      entry_date: entryDate,
      entry_type: dto.entry_type,
      source_type: dto.source_type || null,
      source_id: dto.source_id || null,
      description: dto.description,
      reference_number: dto.reference_number,
      total_debit_bs: totalDebitBs,
      total_credit_bs: totalCreditBs,
      total_debit_usd: totalDebitUsd,
      total_credit_usd: totalCreditUsd,
      exchange_rate: dto.exchange_rate || null,
      currency: dto.currency || 'BS',
      status: 'draft',
      is_auto_generated: false,
      metadata: dto.metadata,
    });

    const savedEntry = await this.journalEntryRepository.save(entry);

    // Crear líneas
    const lines = dto.lines.map((lineDto, index) =>
      this.journalEntryLineRepository.create({
        id: randomUUID(),
        entry_id: savedEntry.id,
        line_number: index + 1,
        account_id: lineDto.account_id,
        account_code: lineDto.account_code,
        account_name: lineDto.account_name,
        description: lineDto.description,
        debit_amount_bs: lineDto.debit_amount_bs,
        credit_amount_bs: lineDto.credit_amount_bs,
        debit_amount_usd: lineDto.debit_amount_usd,
        credit_amount_usd: lineDto.credit_amount_usd,
        cost_center: lineDto.cost_center,
        project_code: lineDto.project_code,
        tax_code: lineDto.tax_code,
        metadata: lineDto.metadata,
      }),
    );

    await this.journalEntryLineRepository.save(lines);

    return this.journalEntryRepository.findOne({
      where: { id: savedEntry.id },
      relations: ['lines'],
    }) as Promise<JournalEntry>;
  }

  /**
   * Generar asiento contable automático desde una venta
   */
  async generateEntryFromSale(storeId: string, sale: Sale): Promise<JournalEntry | null> {
    try {
      // Obtener mapeos de cuentas
      const revenueMapping = await this.getAccountMapping(storeId, 'sale_revenue', sale.payment);
      const costMapping = await this.getAccountMapping(storeId, 'sale_cost', sale.payment);
      const cashMapping = await this.getAccountMapping(storeId, 'cash_asset', sale.payment);
      const receivableMapping = await this.getAccountMapping(storeId, 'accounts_receivable', sale.payment);

      if (!revenueMapping || !costMapping) {
        this.logger.warn(`No se encontraron mapeos de cuentas para venta ${sale.id}`);
        return null;
      }

      const entryDate = new Date(sale.sold_at);
      const entryNumber = await this.generateEntryNumber(storeId, entryDate);

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

      const totalBs = sale.totals.total_bs;
      const totalUsd = sale.totals.total_usd;
      const costBs = 0; // TODO: Calcular costo real desde sale_items
      const costUsd = 0;

      // Si es FIAO, usar cuenta por cobrar
      if (sale.payment.method === 'FIAO') {
        if (receivableMapping) {
          lines.push({
            account_id: receivableMapping.account_id,
            account_code: receivableMapping.account_code,
            account_name: receivableMapping.account_code, // Usar código como nombre temporal
            debit_amount_bs: totalBs,
            credit_amount_bs: 0,
            debit_amount_usd: totalUsd,
            credit_amount_usd: 0,
            description: `Venta FIAO - ${sale.invoice_full_number || sale.id}`,
          });
        }
      } else {
        // Si es pago inmediato, usar cuenta de caja
        if (cashMapping) {
          lines.push({
            account_id: cashMapping.account_id,
            account_code: cashMapping.account_code,
            account_name: cashMapping.account_code,
            debit_amount_bs: totalBs,
            credit_amount_bs: 0,
            debit_amount_usd: totalUsd,
            credit_amount_usd: 0,
            description: `Cobro de venta - ${sale.invoice_full_number || sale.id}`,
          });
        }
      }

      // Ingreso por venta
      lines.push({
        account_id: revenueMapping.account_id,
        account_code: revenueMapping.account_code,
        account_name: revenueMapping.account_code,
        debit_amount_bs: 0,
        credit_amount_bs: totalBs,
        debit_amount_usd: 0,
        credit_amount_usd: totalUsd,
        description: `Venta - ${sale.invoice_full_number || sale.id}`,
      });

      // Costo de venta (si aplica)
      if (costBs > 0 || costUsd > 0) {
        lines.push({
          account_id: costMapping.account_id,
          account_code: costMapping.account_code,
          account_name: costMapping.account_code,
          debit_amount_bs: costBs,
          credit_amount_bs: 0,
          debit_amount_usd: costUsd,
          credit_amount_usd: 0,
          description: `Costo de venta - ${sale.invoice_full_number || sale.id}`,
        });

        // Descontar inventario
        const inventoryMapping = await this.getAccountMapping(storeId, 'inventory_asset', sale.payment);
        if (inventoryMapping) {
          lines.push({
            account_id: inventoryMapping.account_id,
            account_code: inventoryMapping.account_code,
            account_name: inventoryMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: costBs,
            debit_amount_usd: 0,
            credit_amount_usd: costUsd,
            description: `Salida de inventario - ${sale.invoice_full_number || sale.id}`,
          });
        }
      }

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'sale',
        source_type: 'sale',
        source_id: sale.id,
        description: `Venta ${sale.invoice_full_number || sale.id}`,
        reference_number: sale.invoice_full_number || sale.id,
        total_debit_bs: lines.reduce((sum, l) => sum + l.debit_amount_bs, 0),
        total_credit_bs: lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
        total_debit_usd: lines.reduce((sum, l) => sum + l.debit_amount_usd, 0),
        total_credit_usd: lines.reduce((sum, l) => sum + l.credit_amount_usd, 0),
        exchange_rate: sale.exchange_rate,
        currency: sale.currency,
        status: 'posted', // Auto-postear asientos generados
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: { sale_id: sale.id },
      });

      const savedEntry = await this.journalEntryRepository.save(entry);

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

      // Actualizar saldos
      await this.updateAccountBalances(storeId, entryDate, lines);

      return this.journalEntryRepository.findOne({
        where: { id: savedEntry.id },
        relations: ['lines'],
      }) as Promise<JournalEntry>;
    } catch (error) {
      this.logger.error(`Error generando asiento desde venta ${sale.id}`, error instanceof Error ? error.stack : String(error));
      return null;
    }
  }

  /**
   * Obtener mapeo de cuenta por tipo de transacción
   */
  private async getAccountMapping(
    storeId: string,
    transactionType: TransactionType,
    conditions?: any,
  ): Promise<AccountingAccountMapping | null> {
    // Buscar mapeo con condiciones específicas primero
    if (conditions) {
      const specificMapping = await this.mappingRepository.findOne({
        where: {
          store_id: storeId,
          transaction_type: transactionType,
          is_active: true,
          conditions: conditions,
        },
      });

      if (specificMapping) {
        return specificMapping;
      }
    }

    // Buscar mapeo por defecto
    return this.mappingRepository.findOne({
      where: {
        store_id: storeId,
        transaction_type: transactionType,
        is_default: true,
        is_active: true,
      },
    });
  }

  /**
   * Actualizar saldos de cuentas
   */
  private async updateAccountBalances(
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
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth();
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0);

    for (const line of lines) {
      let balance = await this.balanceRepository.findOne({
        where: {
          store_id: storeId,
          account_id: line.account_id,
          period_start: periodStart,
          period_end: periodEnd,
        },
      });

      if (!balance) {
        const account = await this.accountRepository.findOne({
          where: { id: line.account_id },
        });

        if (!account) continue;

        balance = this.balanceRepository.create({
          id: randomUUID(),
          store_id: storeId,
          account_id: line.account_id,
          account_code: account.account_code,
          period_start: periodStart,
          period_end: periodEnd,
        });
      }

      balance.period_debit_bs += line.debit_amount_bs;
      balance.period_credit_bs += line.credit_amount_bs;
      balance.period_debit_usd += line.debit_amount_usd;
      balance.period_credit_usd += line.credit_amount_usd;

      balance.closing_balance_debit_bs = balance.opening_balance_debit_bs + balance.period_debit_bs;
      balance.closing_balance_credit_bs = balance.opening_balance_credit_bs + balance.period_credit_bs;
      balance.closing_balance_debit_usd = balance.opening_balance_debit_usd + balance.period_debit_usd;
      balance.closing_balance_credit_usd = balance.opening_balance_credit_usd + balance.period_credit_usd;

      balance.last_calculated_at = new Date();
      await this.balanceRepository.save(balance);
    }
  }

  /**
   * Obtener asientos contables
   */
  async getJournalEntries(storeId: string, dto: GetJournalEntriesDto): Promise<JournalEntry[]> {
    const query = this.journalEntryRepository.createQueryBuilder('entry')
      .leftJoinAndSelect('entry.lines', 'lines')
      .where('entry.store_id = :storeId', { storeId })
      .orderBy('entry.entry_date', 'DESC')
      .addOrderBy('entry.entry_number', 'DESC');

    if (dto.entry_type) {
      query.andWhere('entry.entry_type = :entryType', { entryType: dto.entry_type });
    }

    if (dto.status) {
      query.andWhere('entry.status = :status', { status: dto.status });
    }

    if (dto.start_date) {
      query.andWhere('entry.entry_date >= :startDate', { startDate: dto.start_date });
    }

    if (dto.end_date) {
      query.andWhere('entry.entry_date <= :endDate', { endDate: dto.end_date });
    }

    if (dto.source_type) {
      query.andWhere('entry.source_type = :sourceType', { sourceType: dto.source_type });
    }

    if (dto.limit) {
      query.limit(dto.limit);
    }

    return query.getMany();
  }

  /**
   * Postear asiento (cambiar de draft a posted)
   */
  async postEntry(storeId: string, entryId: string, userId: string): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id: entryId, store_id: storeId },
      relations: ['lines'],
    });

    if (!entry) {
      throw new NotFoundException('Asiento no encontrado');
    }

    if (entry.status !== 'draft') {
      throw new BadRequestException('Solo se pueden postear asientos en estado draft');
    }

    entry.status = 'posted';
    entry.posted_at = new Date();
    entry.posted_by = userId;

    await this.journalEntryRepository.save(entry);

    // Actualizar saldos
    await this.updateAccountBalances(
      storeId,
      entry.entry_date,
      entry.lines.map((line) => ({
        account_id: line.account_id,
        debit_amount_bs: line.debit_amount_bs,
        credit_amount_bs: line.credit_amount_bs,
        debit_amount_usd: line.debit_amount_usd,
        credit_amount_usd: line.credit_amount_usd,
      })),
    );

    return entry;
  }

  /**
   * Cancelar asiento
   */
  async cancelEntry(
    storeId: string,
    entryId: string,
    userId: string,
    reason: string,
  ): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id: entryId, store_id: storeId },
    });

    if (!entry) {
      throw new NotFoundException('Asiento no encontrado');
    }

    if (entry.status === 'cancelled') {
      throw new BadRequestException('El asiento ya está cancelado');
    }

    entry.status = 'cancelled';
    entry.cancelled_at = new Date();
    entry.cancelled_by = userId;
    entry.cancellation_reason = reason;

    return this.journalEntryRepository.save(entry);
  }

  /**
   * Obtener balance de cuenta
   */
  async getAccountBalance(
    storeId: string,
    accountId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AccountBalance | null> {
    return this.balanceRepository.findOne({
      where: {
        store_id: storeId,
        account_id: accountId,
        period_start: startDate,
        period_end: endDate,
      },
    });
  }
}


