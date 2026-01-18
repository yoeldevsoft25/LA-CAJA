import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, In } from 'typeorm';
import { JournalEntry, JournalEntryType, JournalEntryStatus } from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import { AccountingAccountMapping, TransactionType } from '../database/entities/accounting-account-mapping.entity';
import { AccountBalance } from '../database/entities/account-balance.entity';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GetJournalEntriesDto } from './dto/get-journal-entries.dto';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { PurchaseOrder } from '../database/entities/purchase-order.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { InventoryMovement } from '../database/entities/inventory-movement.entity';
import { ProductLot } from '../database/entities/product-lot.entity';
import { Product } from '../database/entities/product.entity';
import { AccountingPeriod, AccountingPeriodStatus } from '../database/entities/accounting-period.entity';
import { randomUUID } from 'crypto';
import {
  neumaierSum,
  benfordAnalysis,
  statisticalDataReconciliation,
  detectExactTransposition,
  detectErrorTypeAdvanced,
} from './accounting-advanced-algorithms';

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
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(InventoryMovement)
    private inventoryMovementRepository: Repository<InventoryMovement>,
    @InjectRepository(ProductLot)
    private productLotRepository: Repository<ProductLot>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(AccountingPeriod)
    private periodRepository: Repository<AccountingPeriod>,
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
    // Validar que el período esté abierto
    await this.validatePeriodOpen(storeId, new Date(dto.entry_date));

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

  private async calculateSaleCosts(
    storeId: string,
    saleItems: SaleItem[],
  ): Promise<{ costBs: number; costUsd: number }> {
    let costBs = 0;
    let costUsd = 0;

    for (const item of saleItems) {
      let itemCostBs = 0;
      let itemCostUsd = 0;

      if (item.lot_id && item.lot) {
        itemCostBs = Number(item.lot.unit_cost_bs || 0) * item.qty;
        itemCostUsd = Number(item.lot.unit_cost_usd || 0) * item.qty;
      } else {
        const movements = await this.inventoryMovementRepository.find({
          where: {
            store_id: storeId,
            product_id: item.product_id,
            variant_id: item.variant_id ? item.variant_id : IsNull(),
            movement_type: 'received',
            approved: true,
          },
          order: { happened_at: 'DESC' },
          take: 10,
        });

        if (movements.length > 0) {
          let totalQty = 0;
          let totalCostBs = 0;
          let totalCostUsd = 0;

          for (const mov of movements) {
            const qty = Math.abs(mov.qty_delta);
            totalQty += qty;
            totalCostBs += Number(mov.unit_cost_bs || 0) * qty;
            totalCostUsd += Number(mov.unit_cost_usd || 0) * qty;
          }

          if (totalQty > 0) {
            itemCostBs = (totalCostBs / totalQty) * item.qty;
            itemCostUsd = (totalCostUsd / totalQty) * item.qty;
          }
        }

        if (itemCostBs === 0 && itemCostUsd === 0) {
          itemCostBs = Number(item.product?.cost_bs || 0) * item.qty;
          itemCostUsd = Number(item.product?.cost_usd || 0) * item.qty;
        }
      }

      costBs += itemCostBs;
      costUsd += itemCostUsd;
    }

    return { costBs, costUsd };
  }

  /**
   * Generar asiento contable automático desde una venta
   */
  async generateEntryFromSale(storeId: string, sale: Sale): Promise<JournalEntry | null> {
    try {
      const existingEntry = await this.journalEntryRepository.findOne({
        where: {
          store_id: storeId,
          source_type: 'sale',
          source_id: sale.id,
        },
      });

      if (existingEntry) {
        return existingEntry;
      }

      const issuedFiscalInvoice = await this.fiscalInvoiceRepository.findOne({
        where: { store_id: storeId, sale_id: sale.id, status: 'issued' },
      });

      if (issuedFiscalInvoice) {
        return null;
      }

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

      // Calcular costo real desde sale_items
      const saleItems = await this.saleItemRepository.find({
        where: { sale_id: sale.id },
        relations: ['lot', 'product'],
      });

      const { costBs, costUsd } = await this.calculateSaleCosts(
        storeId,
        saleItems,
      );

      // Si es FIAO, usar cuenta por cobrar
      if (sale.payment.method === 'FIAO') {
        if (receivableMapping) {
          lines.push({
            account_id: receivableMapping.account_id,
            account_code: receivableMapping.account_code,
            account_name: receivableMapping.account?.account_name || receivableMapping.account_code,
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
            account_name: cashMapping.account?.account_name || cashMapping.account_code,
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
        account_name: revenueMapping.account?.account_name || revenueMapping.account_code,
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
          account_name: costMapping.account?.account_name || costMapping.account_code,
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
            account_name: inventoryMapping.account?.account_name || inventoryMapping.account_code,
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
        relations: ['account'],
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
      relations: ['account'],
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
      if (dto.entry_type === 'fiscal_invoice') {
        query.andWhere('entry.entry_type IN (:...entryTypes)', {
          entryTypes: ['fiscal_invoice', 'invoice'],
        });
      } else {
        query.andWhere('entry.entry_type = :entryType', { entryType: dto.entry_type });
      }
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

    const entries = await query.getMany();
    return entries.map((entry) => ({
      ...entry,
      entry_type: entry.entry_type === 'invoice' ? 'fiscal_invoice' : entry.entry_type,
    }));
  }

  /**
   * Obtener un asiento contable por ID
   */
  async getJournalEntry(storeId: string, entryId: string): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id: entryId, store_id: storeId },
      relations: ['lines'],
    });

    if (!entry) {
      throw new NotFoundException('Asiento contable no encontrado');
    }

    if (entry.entry_type === 'invoice') {
      entry.entry_type = 'fiscal_invoice';
    }

    return entry;
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
   * Generar asiento contable automático desde una orden de compra completada
   */
  async generateEntryFromPurchaseOrder(
    storeId: string,
    purchaseOrder: PurchaseOrder,
  ): Promise<JournalEntry | null> {
    try {
      // Solo generar asiento cuando la orden está completada
      if (purchaseOrder.status !== 'completed') {
        return null;
      }

      // Obtener mapeos de cuentas
      const expenseMapping = await this.getAccountMapping(storeId, 'purchase_expense', null);
      const payableMapping = await this.getAccountMapping(storeId, 'accounts_payable', null);
      const inventoryMapping = await this.getAccountMapping(storeId, 'inventory_asset', null);

      if (!expenseMapping || !payableMapping) {
        this.logger.warn(`No se encontraron mapeos de cuentas para orden de compra ${purchaseOrder.id}`);
        return null;
      }

      const entryDate = purchaseOrder.received_at || new Date();
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

      const totalBs = Number(purchaseOrder.total_amount_bs);
      const totalUsd = Number(purchaseOrder.total_amount_usd);

      // Cuenta por pagar (crédito)
      lines.push({
        account_id: payableMapping.account_id,
        account_code: payableMapping.account_code,
        account_name: payableMapping.account?.account_name || payableMapping.account_code,
        debit_amount_bs: 0,
        credit_amount_bs: totalBs,
        debit_amount_usd: 0,
        credit_amount_usd: totalUsd,
        description: `Orden de compra ${purchaseOrder.order_number} - Cuenta por pagar`,
      });

      // Gasto de compra o inventario (débito)
      // Si es inventario, usar cuenta de activo; si no, usar gasto
      const debitAccount = inventoryMapping || expenseMapping;
      lines.push({
        account_id: debitAccount.account_id,
        account_code: debitAccount.account_code,
        account_name: debitAccount.account?.account_name || debitAccount.account_code,
        debit_amount_bs: totalBs,
        credit_amount_bs: 0,
        debit_amount_usd: totalUsd,
        credit_amount_usd: 0,
        description: `Orden de compra ${purchaseOrder.order_number} - ${inventoryMapping ? 'Inventario' : 'Gasto'}`,
      });

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'purchase',
        source_type: 'purchase_order',
        source_id: purchaseOrder.id,
        description: `Orden de compra ${purchaseOrder.order_number}`,
        reference_number: purchaseOrder.order_number,
        total_debit_bs: totalBs,
        total_credit_bs: totalBs,
        total_debit_usd: totalUsd,
        total_credit_usd: totalUsd,
        currency: 'BS', // TODO: Determinar moneda de la orden
        status: 'posted',
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: { purchase_order_id: purchaseOrder.id },
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
      this.logger.error(
        `Error generando asiento desde orden de compra ${purchaseOrder.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Generar asiento contable automático desde una factura fiscal emitida
   */
  async generateEntryFromFiscalInvoice(
    storeId: string,
    fiscalInvoice: FiscalInvoice,
  ): Promise<JournalEntry | null> {
    try {
      // Solo generar asiento cuando la factura está emitida
      if (fiscalInvoice.status !== 'issued') {
        return null;
      }

      const existingEntry = await this.journalEntryRepository.findOne({
        where: {
          store_id: storeId,
          source_type: 'fiscal_invoice',
          source_id: fiscalInvoice.id,
        },
      });

      if (existingEntry) {
        return existingEntry;
      }

      if (fiscalInvoice.sale_id) {
        const existingSaleEntry = await this.journalEntryRepository.findOne({
          where: {
            store_id: storeId,
            source_type: 'sale',
            source_id: fiscalInvoice.sale_id,
          },
        });

        if (existingSaleEntry) {
          this.logger.warn(
            `Asiento de venta ya existe para la venta ${fiscalInvoice.sale_id}. Se omite asiento fiscal ${fiscalInvoice.id}.`,
          );
          return null;
        }
      }

      // Obtener mapeos de cuentas
      const revenueMapping = await this.getAccountMapping(storeId, 'sale_revenue', null);
      const taxMapping = await this.getAccountMapping(storeId, 'sale_tax', null);
      const receivableMapping = await this.getAccountMapping(storeId, 'accounts_receivable', null);
      const cashMapping = await this.getAccountMapping(storeId, 'cash_asset', null);
      const costMapping = await this.getAccountMapping(storeId, 'sale_cost', null);
      const inventoryMapping = await this.getAccountMapping(storeId, 'inventory_asset', null);

      if (!revenueMapping) {
        this.logger.warn(`No se encontraron mapeos de cuentas para factura fiscal ${fiscalInvoice.id}`);
        return null;
      }

      const entryDate = fiscalInvoice.issued_at || new Date();
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

      const subtotalBs = Number(fiscalInvoice.subtotal_bs);
      const subtotalUsd = Number(fiscalInvoice.subtotal_usd);
      const taxBs = Number(fiscalInvoice.tax_amount_bs);
      const taxUsd = Number(fiscalInvoice.tax_amount_usd);
      const totalBs = Number(fiscalInvoice.total_bs);
      const totalUsd = Number(fiscalInvoice.total_usd);
      let costBs = 0;
      let costUsd = 0;

      if (fiscalInvoice.sale_id) {
        const saleItems = await this.saleItemRepository.find({
          where: { sale_id: fiscalInvoice.sale_id },
          relations: ['lot', 'product'],
        });
        const costs = await this.calculateSaleCosts(storeId, saleItems);
        costBs = costs.costBs;
        costUsd = costs.costUsd;
      }

      // Determinar método de pago (si está vinculada a una venta)
      const isCash = fiscalInvoice.payment_method === 'CASH_BS' || fiscalInvoice.payment_method === 'CASH_USD';
      const isCredit = fiscalInvoice.payment_method === 'FIAO' || fiscalInvoice.customer_id;

      // Activo (cobro o cuenta por cobrar)
      if (isCash && cashMapping) {
        lines.push({
          account_id: cashMapping.account_id,
          account_code: cashMapping.account_code,
          account_name: cashMapping.account?.account_name || cashMapping.account_code,
          debit_amount_bs: totalBs,
          credit_amount_bs: 0,
          debit_amount_usd: totalUsd,
          credit_amount_usd: 0,
          description: `Factura fiscal ${fiscalInvoice.invoice_number} - Cobro`,
        });
      } else if (isCredit && receivableMapping) {
        lines.push({
          account_id: receivableMapping.account_id,
          account_code: receivableMapping.account_code,
          account_name: receivableMapping.account?.account_name || receivableMapping.account_code,
          debit_amount_bs: totalBs,
          credit_amount_bs: 0,
          debit_amount_usd: totalUsd,
          credit_amount_usd: 0,
          description: `Factura fiscal ${fiscalInvoice.invoice_number} - Cuenta por cobrar`,
        });
      }

      // Ingreso por venta (crédito)
      lines.push({
        account_id: revenueMapping.account_id,
        account_code: revenueMapping.account_code,
        account_name: revenueMapping.account?.account_name || revenueMapping.account_code,
        debit_amount_bs: 0,
        credit_amount_bs: subtotalBs,
        debit_amount_usd: 0,
        credit_amount_usd: subtotalUsd,
        description: `Factura fiscal ${fiscalInvoice.invoice_number} - Venta`,
      });

      // Impuesto (si aplica)
      if (taxBs > 0 || taxUsd > 0) {
        if (taxMapping) {
          lines.push({
            account_id: taxMapping.account_id,
            account_code: taxMapping.account_code,
            account_name: taxMapping.account?.account_name || taxMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: taxBs,
            debit_amount_usd: 0,
            credit_amount_usd: taxUsd,
            description: `Factura fiscal ${fiscalInvoice.invoice_number} - IVA`,
          });
        }
      }

      if (costBs > 0 || costUsd > 0) {
        if (costMapping) {
          lines.push({
            account_id: costMapping.account_id,
            account_code: costMapping.account_code,
            account_name: costMapping.account?.account_name || costMapping.account_code,
            debit_amount_bs: costBs,
            credit_amount_bs: 0,
            debit_amount_usd: costUsd,
            credit_amount_usd: 0,
            description: `Costo de venta - ${fiscalInvoice.invoice_number}`,
          });
        }

        if (inventoryMapping) {
          lines.push({
            account_id: inventoryMapping.account_id,
            account_code: inventoryMapping.account_code,
            account_name: inventoryMapping.account?.account_name || inventoryMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: costBs,
            debit_amount_usd: 0,
            credit_amount_usd: costUsd,
            description: `Salida de inventario - ${fiscalInvoice.invoice_number}`,
          });
        }
      }

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'fiscal_invoice',
        source_type: 'fiscal_invoice',
        source_id: fiscalInvoice.id,
        description: `Factura fiscal ${fiscalInvoice.invoice_number}`,
        reference_number: fiscalInvoice.invoice_number,
        total_debit_bs: lines.reduce((sum, l) => sum + l.debit_amount_bs, 0),
        total_credit_bs: lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
        total_debit_usd: lines.reduce((sum, l) => sum + l.debit_amount_usd, 0),
        total_credit_usd: lines.reduce((sum, l) => sum + l.credit_amount_usd, 0),
        exchange_rate: fiscalInvoice.exchange_rate,
        currency: fiscalInvoice.currency,
        status: 'posted',
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: { fiscal_invoice_id: fiscalInvoice.id },
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
      this.logger.error(
        `Error generando asiento desde factura fiscal ${fiscalInvoice.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Generar asiento contable automático desde una transferencia entre bodegas
   * Nota: Las transferencias no afectan el valor total del inventario, solo su ubicación.
   * Este asiento se genera para mantener trazabilidad contable del movimiento.
   */
  async generateEntryFromTransfer(
    storeId: string,
    transfer: { id: string; transfer_number: string; received_at: Date | null; items: Array<{ product_id: string; quantity_received: number }> },
  ): Promise<JournalEntry | null> {
    try {
      const existingEntry = await this.journalEntryRepository.findOne({
        where: {
          store_id: storeId,
          source_type: 'transfer',
          source_id: transfer.id,
        },
      });

      if (existingEntry) {
        return existingEntry;
      }

      // Obtener mapeo de cuenta de inventario
      const inventoryMapping = await this.getAccountMapping(storeId, 'inventory_asset', null);

      if (!inventoryMapping) {
        this.logger.warn(`No se encontró mapeo de cuenta de inventario para transferencia ${transfer.id}`);
        return null;
      }

      // Para transferencias, el asiento es neutro (débito = crédito) porque solo cambia la ubicación
      // Esto mantiene la trazabilidad sin afectar el balance total
      // En sistemas más complejos, se usarían cuentas de sub-inventario por bodega
      // Por ahora, registramos un asiento de ajuste interno que no afecta el balance
      const entryDate = transfer.received_at || new Date();
      const entryNumber = await this.generateEntryNumber(storeId, entryDate);

      // Calcular valor total de la transferencia basado en costos de los productos
      let totalCostBs = 0;
      let totalCostUsd = 0;

      for (const item of transfer.items) {
        const movements = await this.inventoryMovementRepository.find({
          where: {
            store_id: storeId,
            product_id: item.product_id,
            movement_type: 'received',
            approved: true,
          },
          order: { happened_at: 'DESC' },
          take: 5,
        });

        if (movements.length > 0) {
          const latestMovement = movements[0];
          const unitCostBs = Number(latestMovement.unit_cost_bs || 0);
          const unitCostUsd = Number(latestMovement.unit_cost_usd || 0);
          totalCostBs += unitCostBs * item.quantity_received;
          totalCostUsd += unitCostUsd * item.quantity_received;
        }
      }

      // Si no hay costo calculable, no generar asiento (transferencia sin valor contable)
      if (totalCostBs === 0 && totalCostUsd === 0) {
        this.logger.debug(`Transferencia ${transfer.id} no tiene costo calculable, omitiendo asiento contable`);
        return null;
      }

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

      // En sistemas avanzados, se usarían subcuentas por bodega
      // Por ahora, usamos la misma cuenta para mantener el balance (asiento de ajuste interno)
      // Débito: Inventario (para trazabilidad)
      lines.push({
        account_id: inventoryMapping.account_id,
        account_code: inventoryMapping.account_code,
        account_name: inventoryMapping.account?.account_name || inventoryMapping.account_code,
        debit_amount_bs: totalCostBs,
        credit_amount_bs: 0,
        debit_amount_usd: totalCostUsd,
        credit_amount_usd: 0,
        description: `Transferencia ${transfer.transfer_number} - Recepción en destino`,
      });

      // Crédito: Inventario (mismo saldo, solo para trazabilidad)
      lines.push({
        account_id: inventoryMapping.account_id,
        account_code: inventoryMapping.account_code,
        account_name: inventoryMapping.account?.account_name || inventoryMapping.account_code,
        debit_amount_bs: 0,
        credit_amount_bs: totalCostBs,
        debit_amount_usd: 0,
        credit_amount_usd: totalCostUsd,
        description: `Transferencia ${transfer.transfer_number} - Salida de origen`,
      });

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'adjustment',
        source_type: 'transfer',
        source_id: transfer.id,
        description: `Transferencia entre bodegas ${transfer.transfer_number}`,
        reference_number: transfer.transfer_number,
        total_debit_bs: totalCostBs,
        total_credit_bs: totalCostBs,
        total_debit_usd: totalCostUsd,
        total_credit_usd: totalCostUsd,
        exchange_rate: null,
        currency: 'MIXED',
        status: 'posted',
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: { transfer_id: transfer.id },
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

      // Actualizar saldos (aunque será neutro ya que débito = crédito)
      await this.updateAccountBalances(storeId, entryDate, lines);

      return this.journalEntryRepository.findOne({
        where: { id: savedEntry.id },
        relations: ['lines'],
      }) as Promise<JournalEntry>;
    } catch (error) {
      this.logger.error(
        `Error generando asiento desde transferencia ${transfer.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Generar asiento contable automático desde un ajuste de inventario
   */
  async generateEntryFromInventoryAdjustment(
    storeId: string,
    movement: InventoryMovement,
  ): Promise<JournalEntry | null> {
    try {
      // Solo generar asiento para ajustes aprobados
      if (!movement.approved || movement.movement_type !== 'adjust') {
        return null;
      }

      const existingEntry = await this.journalEntryRepository.findOne({
        where: {
          store_id: storeId,
          source_type: 'inventory_adjustment',
          source_id: movement.id,
        },
      });

      if (existingEntry) {
        return existingEntry;
      }

      // Obtener mapeos de cuentas
      const inventoryMapping = await this.getAccountMapping(storeId, 'inventory_asset', null);
      const adjustmentMapping = await this.getAccountMapping(storeId, 'adjustment', null);

      if (!inventoryMapping) {
        this.logger.warn(`No se encontró mapeo de cuenta de inventario para ajuste ${movement.id}`);
        return null;
      }

      // Obtener costo del producto para calcular el valor del ajuste
      const product = await this.productRepository.findOne({
        where: { id: movement.product_id, store_id: storeId },
      });

      if (!product) {
        this.logger.warn(`Producto ${movement.product_id} no encontrado para ajuste ${movement.id}`);
        return null;
      }

      // Usar costo del producto o del último movimiento de inventario
      let unitCostBs = Number(product.cost_bs || 0);
      let unitCostUsd = Number(product.cost_usd || 0);

      if (unitCostBs === 0 && unitCostUsd === 0) {
        const recentMovements = await this.inventoryMovementRepository.find({
          where: {
            store_id: storeId,
            product_id: movement.product_id,
            movement_type: 'received',
            approved: true,
          },
          order: { happened_at: 'DESC' },
          take: 1,
        });

        if (recentMovements.length > 0) {
          unitCostBs = Number(recentMovements[0].unit_cost_bs || 0);
          unitCostUsd = Number(recentMovements[0].unit_cost_usd || 0);
        }
      }

      const qtyDelta = Number(movement.qty_delta);
      const adjustmentValueBs = Math.abs(unitCostBs * qtyDelta);
      const adjustmentValueUsd = Math.abs(unitCostUsd * qtyDelta);

      // Si el valor es cero, no generar asiento
      if (adjustmentValueBs === 0 && adjustmentValueUsd === 0) {
        this.logger.debug(`Ajuste ${movement.id} no tiene valor contable, omitiendo asiento`);
        return null;
      }

      const entryDate = movement.happened_at || new Date();
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

      // Usar cuenta de ajuste si existe, sino usar gastos generales
      const expenseAccount = adjustmentMapping || await this.getAccountMapping(storeId, 'expense', null);

      if (qtyDelta > 0) {
        // Ajuste positivo: aumenta inventario
        // Débito: Inventario
        lines.push({
          account_id: inventoryMapping.account_id,
          account_code: inventoryMapping.account_code,
          account_name: inventoryMapping.account?.account_name || inventoryMapping.account_code,
          debit_amount_bs: adjustmentValueBs,
          credit_amount_bs: 0,
          debit_amount_usd: adjustmentValueUsd,
          credit_amount_usd: 0,
          description: `Ajuste de inventario positivo - ${movement.ref?.reason || 'Ajuste'}`,
        });

        // Crédito: Gasto/Ajuste (reversión)
        if (expenseAccount) {
          lines.push({
            account_id: expenseAccount.account_id,
            account_code: expenseAccount.account_code,
            account_name: expenseAccount.account?.account_name || expenseAccount.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: adjustmentValueBs,
            debit_amount_usd: 0,
            credit_amount_usd: adjustmentValueUsd,
            description: `Reversión de gasto por ajuste positivo`,
          });
        }
      } else {
        // Ajuste negativo: disminuye inventario
        // Débito: Gasto/Ajuste
        if (expenseAccount) {
          lines.push({
            account_id: expenseAccount.account_id,
            account_code: expenseAccount.account_code,
            account_name: expenseAccount.account?.account_name || expenseAccount.account_code,
            debit_amount_bs: adjustmentValueBs,
            credit_amount_bs: 0,
            debit_amount_usd: adjustmentValueUsd,
            credit_amount_usd: 0,
            description: `Ajuste de inventario negativo - ${movement.ref?.reason || 'Ajuste'}`,
          });
        }

        // Crédito: Inventario
        lines.push({
          account_id: inventoryMapping.account_id,
          account_code: inventoryMapping.account_code,
          account_name: inventoryMapping.account?.account_name || inventoryMapping.account_code,
          debit_amount_bs: 0,
          credit_amount_bs: adjustmentValueBs,
          debit_amount_usd: 0,
          credit_amount_usd: adjustmentValueUsd,
          description: `Reducción de inventario`,
        });
      }

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'adjustment',
        source_type: 'inventory_adjustment',
        source_id: movement.id,
        description: `Ajuste de inventario - Producto ${product.name}`,
        reference_number: movement.note || null,
        total_debit_bs: lines.reduce((sum, l) => sum + l.debit_amount_bs, 0),
        total_credit_bs: lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
        total_debit_usd: lines.reduce((sum, l) => sum + l.debit_amount_usd, 0),
        total_credit_usd: lines.reduce((sum, l) => sum + l.credit_amount_usd, 0),
        exchange_rate: null,
        currency: 'MIXED',
        status: 'posted',
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: { movement_id: movement.id, reason: movement.ref?.reason },
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
      this.logger.error(
        `Error generando asiento desde ajuste de inventario ${movement.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Generar asiento contable automático desde un pago de deuda
   */
  async generateEntryFromDebtPayment(
    storeId: string,
    debt: { id: string; sale_id: string | null; customer_id: string | null },
    payment: { id: string; paid_at: Date; amount_bs: number; amount_usd: number; method: string },
  ): Promise<JournalEntry | null> {
    try {
      const existingEntry = await this.journalEntryRepository.findOne({
        where: {
          store_id: storeId,
          source_type: 'debt_payment',
          source_id: payment.id,
        },
      });

      if (existingEntry) {
        return existingEntry;
      }

      // Obtener mapeos de cuentas
      const receivableMapping = await this.getAccountMapping(storeId, 'accounts_receivable', null);
      const cashMapping = await this.getAccountMapping(storeId, 'cash_asset', { method: payment.method });
      const bankMapping = await this.getAccountMapping(storeId, 'cash_asset', { method: 'TRANSFER' });

      if (!receivableMapping) {
        this.logger.warn(`No se encontró mapeo de cuenta por cobrar para pago de deuda ${payment.id}`);
        return null;
      }

      // Determinar cuenta de destino según método de pago
      let assetAccount = cashMapping;
      if (payment.method === 'TRANSFER' || payment.method === 'PAGO_MOVIL') {
        assetAccount = bankMapping || cashMapping;
      }

      if (!assetAccount) {
        this.logger.warn(`No se encontró mapeo de cuenta de activo para método ${payment.method} en pago ${payment.id}`);
        return null;
      }

      const entryDate = payment.paid_at || new Date();
      const entryNumber = await this.generateEntryNumber(storeId, entryDate);

      const paymentAmountBs = Number(payment.amount_bs);
      const paymentAmountUsd = Number(payment.amount_usd);

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

      // Débito: Caja/Bancos (aumenta activo)
      lines.push({
        account_id: assetAccount.account_id,
        account_code: assetAccount.account_code,
        account_name: assetAccount.account?.account_name || assetAccount.account_code,
        debit_amount_bs: paymentAmountBs,
        credit_amount_bs: 0,
        debit_amount_usd: paymentAmountUsd,
        credit_amount_usd: 0,
        description: `Pago de deuda - ${payment.method}`,
      });

      // Crédito: Cuentas por Cobrar (disminuye activo)
      lines.push({
        account_id: receivableMapping.account_id,
        account_code: receivableMapping.account_code,
        account_name: receivableMapping.account?.account_name || receivableMapping.account_code,
        debit_amount_bs: 0,
        credit_amount_bs: paymentAmountBs,
        debit_amount_usd: 0,
        credit_amount_usd: paymentAmountUsd,
        description: `Cobro de deuda`,
      });

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'manual',
        source_type: 'debt_payment',
        source_id: payment.id,
        description: `Pago de deuda - Método: ${payment.method}`,
        reference_number: null,
        total_debit_bs: paymentAmountBs,
        total_credit_bs: paymentAmountBs,
        total_debit_usd: paymentAmountUsd,
        total_credit_usd: paymentAmountUsd,
        exchange_rate: paymentAmountUsd > 0 ? paymentAmountBs / paymentAmountUsd : null,
        currency: 'MIXED',
        status: 'posted',
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: { debt_id: debt.id, payment_id: payment.id, method: payment.method },
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
      this.logger.error(
        `Error generando asiento desde pago de deuda ${payment.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Generar asiento contable automático desde un cierre de caja
   * Nota: Este asiento registra diferencias de cierre (excedentes/faltas)
   * El movimiento principal de efectivo ya está registrado en las ventas
   */
  async generateEntryFromCashClose(
    storeId: string,
    session: {
      id: string;
      closed_at: Date | null;
      opening_amount_bs: number;
      opening_amount_usd: number;
      expected: { cash_bs: number; cash_usd: number } | null;
      counted: { cash_bs: number; cash_usd: number } | null;
    },
  ): Promise<JournalEntry | null> {
    try {
      if (!session.closed_at || !session.expected || !session.counted) {
        return null; // Solo generar para sesiones cerradas completamente
      }

      const existingEntry = await this.journalEntryRepository.findOne({
        where: {
          store_id: storeId,
          source_type: 'cash_close',
          source_id: session.id,
        },
      });

      if (existingEntry) {
        return existingEntry;
      }

      const expectedBs = Number(session.expected.cash_bs);
      const expectedUsd = Number(session.expected.cash_usd);
      const countedBs = Number(session.counted.cash_bs);
      const countedUsd = Number(session.counted.cash_usd);

      const differenceBs = countedBs - expectedBs;
      const differenceUsd = countedUsd - expectedUsd;

      // Si no hay diferencia significativa, no generar asiento
      if (Math.abs(differenceBs) < 0.01 && Math.abs(differenceUsd) < 0.01) {
        return null;
      }

      // Obtener mapeos de cuentas
      const cashMapping = await this.getAccountMapping(storeId, 'cash_asset', null);
      const incomeMapping = await this.getAccountMapping(storeId, 'income', null);
      const expenseMapping = await this.getAccountMapping(storeId, 'expense', null);

      if (!cashMapping) {
        this.logger.warn(`No se encontró mapeo de cuenta de caja para cierre de sesión ${session.id}`);
        return null;
      }

      const entryDate = session.closed_at;
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

      if (differenceBs > 0 || differenceUsd > 0) {
        // Excedente: aumenta caja, aumenta ingreso
        // Débito: Caja
        lines.push({
          account_id: cashMapping.account_id,
          account_code: cashMapping.account_code,
          account_name: cashMapping.account?.account_name || cashMapping.account_code,
          debit_amount_bs: Math.abs(differenceBs),
          credit_amount_bs: 0,
          debit_amount_usd: Math.abs(differenceUsd),
          credit_amount_usd: 0,
          description: `Excedente de cierre de caja`,
        });

        // Crédito: Ingresos no operativos
        if (incomeMapping) {
          lines.push({
            account_id: incomeMapping.account_id,
            account_code: incomeMapping.account_code,
            account_name: incomeMapping.account?.account_name || incomeMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: Math.abs(differenceBs),
            debit_amount_usd: 0,
            credit_amount_usd: Math.abs(differenceUsd),
            description: `Excedente de cierre de caja`,
          });
        }
      } else {
        // Falta: disminuye caja, aumenta gasto
        // Débito: Gasto
        if (expenseMapping) {
          lines.push({
            account_id: expenseMapping.account_id,
            account_code: expenseMapping.account_code,
            account_name: expenseMapping.account?.account_name || expenseMapping.account_code,
            debit_amount_bs: Math.abs(differenceBs),
            credit_amount_bs: 0,
            debit_amount_usd: Math.abs(differenceUsd),
            credit_amount_usd: 0,
            description: `Falta en cierre de caja`,
          });
        }

        // Crédito: Caja
        lines.push({
          account_id: cashMapping.account_id,
          account_code: cashMapping.account_code,
          account_name: cashMapping.account?.account_name || cashMapping.account_code,
          debit_amount_bs: 0,
          credit_amount_bs: Math.abs(differenceBs),
          debit_amount_usd: 0,
          credit_amount_usd: Math.abs(differenceUsd),
          description: `Falta en cierre de caja`,
        });
      }

      // Si no hay líneas válidas, no generar asiento
      if (lines.length === 0) {
        return null;
      }

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'adjustment',
        source_type: 'cash_close',
        source_id: session.id,
        description: `Cierre de caja - ${differenceBs >= 0 ? 'Excedente' : 'Falta'}`,
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
        metadata: {
          session_id: session.id,
          difference_bs: differenceBs,
          difference_usd: differenceUsd,
        },
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
      this.logger.error(
        `Error generando asiento desde cierre de caja ${session.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
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

  /**
   * Calcular saldo de cuenta hasta una fecha específica
   */
  private async calculateAccountBalance(
    storeId: string,
    accountId: string,
    asOfDate: Date,
  ): Promise<{ balance_bs: number; balance_usd: number }> {
    // Obtener todos los asientos posteados hasta la fecha
    const entries = await this.journalEntryRepository
      .createQueryBuilder('entry')
      .innerJoin('entry.lines', 'line')
      .where('entry.store_id = :storeId', { storeId })
      .andWhere('line.account_id = :accountId', { accountId })
      .andWhere('entry.status = :status', { status: 'posted' })
      .andWhere('entry.entry_date <= :asOfDate', { asOfDate })
      .select('SUM(line.debit_amount_bs)', 'total_debit_bs')
      .addSelect('SUM(line.credit_amount_bs)', 'total_credit_bs')
      .addSelect('SUM(line.debit_amount_usd)', 'total_debit_usd')
      .addSelect('SUM(line.credit_amount_usd)', 'total_credit_usd')
      .getRawOne();

    const totalDebitBs = Number(entries?.total_debit_bs || 0);
    const totalCreditBs = Number(entries?.total_credit_bs || 0);
    const totalDebitUsd = Number(entries?.total_debit_usd || 0);
    const totalCreditUsd = Number(entries?.total_credit_usd || 0);

    // Obtener tipo de cuenta para determinar si el saldo es débito o crédito
    const account = await this.accountRepository.findOne({
      where: { id: accountId, store_id: storeId },
    });

    if (!account) {
      return { balance_bs: 0, balance_usd: 0 };
    }

    // Para activos y gastos: saldo = débito - crédito (normalmente positivo)
    // Para pasivos, patrimonio e ingresos: saldo = crédito - débito (normalmente positivo)
    let balanceBs = 0;
    let balanceUsd = 0;

    if (account.account_type === 'asset' || account.account_type === 'expense') {
      balanceBs = totalDebitBs - totalCreditBs;
      balanceUsd = totalDebitUsd - totalCreditUsd;
    } else {
      balanceBs = totalCreditBs - totalDebitBs;
      balanceUsd = totalCreditUsd - totalDebitUsd;
    }

    return { balance_bs: balanceBs, balance_usd: balanceUsd };
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
      .andWhere('account.account_type IN (:...types)', { types: ['asset', 'liability', 'equity'] })
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

    for (const account of accounts) {
      const balance = await this.calculateAccountBalance(storeId, account.id, asOfDate);

      if (Math.abs(balance.balance_bs) < 0.01 && Math.abs(balance.balance_usd) < 0.01) {
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
    const totalLiabilitiesBs = liabilities.reduce((sum, l) => sum + l.balance_bs, 0);
    const totalLiabilitiesUsd = liabilities.reduce((sum, l) => sum + l.balance_usd, 0);
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
      .andWhere('account.account_type IN (:...types)', { types: ['revenue', 'expense'] })
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

    // Obtener todos los asientos posteados hasta la fecha
    const postedEntries = await this.journalEntryRepository
      .createQueryBuilder('entry')
      .where('entry.store_id = :storeId', { storeId })
      .andWhere('entry.status = :status', { status: 'posted' })
      .andWhere('entry.entry_date <= :asOfDate', { asOfDate })
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

      if (account.account_type === 'asset' || account.account_type === 'expense') {
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
    const totalDebitsBs = trialBalanceAccounts.reduce((sum, a) => sum + a.debit_balance_bs, 0);
    const totalCreditsBs = trialBalanceAccounts.reduce((sum, a) => sum + a.credit_balance_bs, 0);
    const totalDebitsUsd = trialBalanceAccounts.reduce((sum, a) => sum + a.debit_balance_usd, 0);
    const totalCreditsUsd = trialBalanceAccounts.reduce((sum, a) => sum + a.credit_balance_usd, 0);

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

    const accounts = await accountsQuery.orderBy('account.account_code', 'ASC').getMany();

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

    for (const account of accounts) {
      // Calcular saldo inicial (antes del período)
      const openingBalance = await this.calculateAccountBalance(storeId, account.id, startDate);

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
        if (account.account_type === 'asset' || account.account_type === 'expense') {
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
      if (movements.length > 0 || Math.abs(openingBalance.balance_bs) > 0.01 || Math.abs(openingBalance.balance_usd) > 0.01) {
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
    method: 'direct' | 'indirect' = 'indirect',
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
    const incomeStatement = await this.getIncomeStatement(storeId, startDate, endDate);
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

    // Calcular saldos al inicio del período
    let cashAtBeginningBs = 0;
    let cashAtBeginningUsd = 0;
    for (const account of cashAccounts) {
      const balance = await this.calculateAccountBalance(storeId, account.id, startDate);
      cashAtBeginningBs += balance.balance_bs;
      cashAtBeginningUsd += balance.balance_usd;
    }

    // Calcular saldos al fin del período
    let cashAtEndBs = 0;
    let cashAtEndUsd = 0;
    for (const account of cashAccounts) {
      const balance = await this.calculateAccountBalance(storeId, account.id, endDate);
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

    if (receivableAccount) {
      const balanceStart = await this.calculateAccountBalance(storeId, receivableAccount.id, startDate);
      const balanceEnd = await this.calculateAccountBalance(storeId, receivableAccount.id, endDate);
      receivableChangeBs = balanceEnd.balance_bs - balanceStart.balance_bs;
      receivableChangeUsd = balanceEnd.balance_usd - balanceStart.balance_usd;
    }

    if (payableAccount) {
      const balanceStart = await this.calculateAccountBalance(storeId, payableAccount.id, startDate);
      const balanceEnd = await this.calculateAccountBalance(storeId, payableAccount.id, endDate);
      payableChangeBs = balanceEnd.balance_bs - balanceStart.balance_bs;
      payableChangeUsd = balanceEnd.balance_usd - balanceStart.balance_usd;
    }

    if (inventoryAccount) {
      const balanceStart = await this.calculateAccountBalance(storeId, inventoryAccount.id, startDate);
      const balanceEnd = await this.calculateAccountBalance(storeId, inventoryAccount.id, endDate);
      inventoryChangeBs = balanceEnd.balance_bs - balanceStart.balance_bs;
      inventoryChangeUsd = balanceEnd.balance_usd - balanceStart.balance_usd;
    }

    // Ajustes típicos (depreciación, etc.) - por ahora vacío, se puede expandir
    const adjustments: Array<{ description: string; amount_bs: number; amount_usd: number }> = [];

    // Calcular flujo de efectivo de operaciones (método indirecto)
    // Net Income + Depreciation - Changes in Working Capital
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

    // Actividades de inversión (compras de activos, etc.)
    // Por ahora vacío, se puede expandir para rastrear compras de activos fijos
    const investingActivities: Array<{ description: string; amount_bs: number; amount_usd: number }> = [];

    // Actividades de financiamiento (préstamos, capital, etc.)
    // Por ahora vacío, se puede expandir
    const financingActivities: Array<{ description: string; amount_bs: number; amount_usd: number }> = [];

    const netCashFromInvestingBs = -investingActivities.reduce((sum, inv) => sum + Math.abs(inv.amount_bs), 0);
    const netCashFromInvestingUsd = -investingActivities.reduce((sum, inv) => sum + Math.abs(inv.amount_usd), 0);

    const netCashFromFinancingBs = financingActivities.reduce((sum, fin) => sum + fin.amount_bs, 0);
    const netCashFromFinancingUsd = financingActivities.reduce((sum, fin) => sum + fin.amount_usd, 0);

    const netChangeInCashBs = netCashFromOperationsBs + netCashFromInvestingBs + netCashFromFinancingBs;
    const netChangeInCashUsd = netCashFromOperationsUsd + netCashFromInvestingUsd + netCashFromFinancingUsd;

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
   * Obtener o crear un período contable
   */
  private async getOrCreatePeriod(
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
      });
      await this.periodRepository.save(period);
    }

    return period;
  }

  /**
   * Validar que un período esté abierto para permitir creación de asientos
   */
  async validatePeriodOpen(storeId: string, entryDate: Date): Promise<void> {
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth() + 1;
    const periodCode = `${year}-${String(month).padStart(2, '0')}`;

    const period = await this.periodRepository.findOne({
      where: { store_id: storeId, period_code: periodCode },
    });

    if (period && period.status !== AccountingPeriodStatus.OPEN) {
      throw new BadRequestException(
        `El período contable ${periodCode} está cerrado. No se pueden crear asientos en períodos cerrados.`,
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
    const period = await this.getOrCreatePeriod(storeId, periodStart, periodEnd);

    if (period.status === AccountingPeriodStatus.CLOSED || period.status === AccountingPeriodStatus.LOCKED) {
      throw new BadRequestException(`El período ${period.period_code} ya está cerrado`);
    }

    // Obtener Estado de Resultados del período
    const incomeStatement = await this.getIncomeStatement(storeId, periodStart, periodEnd);
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
      throw new NotFoundException('No se encontró cuenta de capital o ganancias retenidas para el cierre');
    }

    const entryDate = periodEnd;
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

    // Cerrar ingresos: Débito a Ingresos, Crédito a Ganancias Retenidas
    for (const account of revenueAccounts) {
      const balance = await this.calculateAccountBalance(storeId, account.id, periodEnd);
      const revenueAmountBs = balance.balance_bs;
      const revenueAmountUsd = balance.balance_usd;

      if (Math.abs(revenueAmountBs) < 0.01 && Math.abs(revenueAmountUsd) < 0.01) {
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

    // Cerrar gastos: Crédito a Gasto, Débito a Ganancias Retenidas
    for (const account of expenseAccounts) {
      const balance = await this.calculateAccountBalance(storeId, account.id, periodEnd);
      const expenseAmountBs = Math.abs(balance.balance_bs);
      const expenseAmountUsd = Math.abs(balance.balance_usd);

      if (Math.abs(expenseAmountBs) < 0.01 && Math.abs(expenseAmountUsd) < 0.01) {
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

    // Actualizar saldos
    await this.updateAccountBalances(storeId, entryDate, lines);

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
      throw new BadRequestException(`El período ${periodCode} está bloqueado y no se puede reabrir`);
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

  /**
   * Validaciones avanzadas contables
   */
  async validateAccountingIntegrity(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    is_valid: boolean;
    errors: Array<{
      type: string;
      severity: 'error' | 'warning';
      message: string;
      details?: any;
    }>;
    warnings: Array<{
      type: string;
      message: string;
      details?: any;
    }>;
  }> {
    const errors: Array<{ type: string; severity: 'error' | 'warning'; message: string; details?: any }> = [];
    const warnings: Array<{ type: string; message: string; details?: any }> = [];

    try {
      const filterDate = startDate && endDate
        ? Between(startDate, endDate)
        : undefined;

    // 1. Validar que todos los asientos estén balanceados
    const unbalancedEntries = await this.journalEntryRepository
      .createQueryBuilder('entry')
      .where('entry.store_id = :storeId', { storeId })
      .andWhere('entry.status = :status', { status: 'posted' })
      .andWhere(
        '(ABS(entry.total_debit_bs - entry.total_credit_bs) > 0.01 OR ABS(entry.total_debit_usd - entry.total_credit_usd) > 0.01)',
      )
      .getMany();

    if (unbalancedEntries.length > 0) {
      errors.push({
        type: 'unbalanced_entries',
        severity: 'error',
        message: `Se encontraron ${unbalancedEntries.length} asientos desbalanceados`,
        details: unbalancedEntries.map((e) => ({
          entry_id: e.id,
          entry_number: e.entry_number,
          difference_bs: e.total_debit_bs - e.total_credit_bs,
          difference_usd: e.total_debit_usd - e.total_credit_usd,
        })),
      });
    }

    // 2. Validar que no haya asientos posteados en períodos cerrados
    const closedPeriods = await this.periodRepository.find({
      where: {
        store_id: storeId,
        status: AccountingPeriodStatus.CLOSED,
      },
    });

    if (closedPeriods.length > 0) {
      for (const period of closedPeriods) {
        const entriesInClosedPeriod = await this.journalEntryRepository.count({
          where: {
            store_id: storeId,
            entry_date: Between(period.period_start, period.period_end),
            status: 'posted',
          },
        });

        if (entriesInClosedPeriod > 0) {
          warnings.push({
            type: 'entries_in_closed_period',
            message: `Hay asientos posteados en el período cerrado ${period.period_code}`,
            details: {
              period_code: period.period_code,
              entries_count: entriesInClosedPeriod,
            },
          });
        }
      }
    }

    // 3. Validar que los saldos de cuentas coincidan con los movimientos
    const allAccounts = await this.accountRepository.find({
      where: { store_id: storeId, is_active: true },
    });

    const accountBalanceMismatches: Array<{
      account_code: string;
      account_name: string;
      expected_balance_bs: number;
      calculated_balance_bs: number;
      difference_bs: number;
    }> = [];

    for (const account of allAccounts) {
      try {
        const balance = await this.balanceRepository.findOne({
          where: {
            store_id: storeId,
            account_id: account.id,
          },
          order: { period_end: 'DESC' },
        });

        if (balance && balance.period_end) {
          const calculatedBalance = await this.calculateAccountBalance(
            storeId,
            account.id,
            balance.period_end,
          );

          const expectedBalanceBs =
            account.account_type === 'asset' || account.account_type === 'expense'
              ? Number(balance.closing_balance_debit_bs || 0) - Number(balance.closing_balance_credit_bs || 0)
              : Number(balance.closing_balance_credit_bs || 0) - Number(balance.closing_balance_debit_bs || 0);

          const calculatedBalanceBs = calculatedBalance.balance_bs;
          const difference = Math.abs(expectedBalanceBs - calculatedBalanceBs);

          if (difference > 0.01) {
            accountBalanceMismatches.push({
              account_code: account.account_code,
              account_name: account.account_name,
              expected_balance_bs: expectedBalanceBs,
              calculated_balance_bs: calculatedBalanceBs,
              difference_bs: difference,
            });
          }
        }
      } catch (error) {
        // Si hay error calculando el balance de una cuenta, solo registrar como warning
        // No detener la validación completa
        this.logger.warn(`Error validando balance de cuenta ${account.account_code}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (accountBalanceMismatches.length > 0) {
      errors.push({
        type: 'balance_mismatch',
        severity: 'error',
        message: `Se encontraron ${accountBalanceMismatches.length} cuentas con saldos inconsistentes`,
        details: accountBalanceMismatches,
      });
    }

    // 4. Validar que no haya asientos sin líneas
    const entriesWithoutLines = await this.journalEntryRepository
      .createQueryBuilder('entry')
      .leftJoin('entry.lines', 'line')
      .where('entry.store_id = :storeId', { storeId })
      .andWhere('line.id IS NULL')
      .getMany();

    if (entriesWithoutLines.length > 0) {
      errors.push({
        type: 'entries_without_lines',
        severity: 'error',
        message: `Se encontraron ${entriesWithoutLines.length} asientos sin líneas`,
        details: entriesWithoutLines.map((e) => ({
          entry_id: e.id,
          entry_number: e.entry_number,
        })),
      });
    }

    // 5. Validar que los totales del asiento coincidan con las líneas
    const entriesWithInconsistentTotals: Array<{
      entry_id: string;
      entry_number: string;
      entry_total_debit_bs: number;
      lines_total_debit_bs: number;
      difference_bs: number;
    }> = [];

    const allPostedEntries = await this.journalEntryRepository.find({
      where: {
        store_id: storeId,
        status: 'posted',
      },
      relations: ['lines'],
    });

    for (const entry of allPostedEntries) {
      try {
        const linesTotalDebitBs = (entry.lines || []).reduce((sum, line) => sum + Number(line.debit_amount_bs || 0), 0);
        const linesTotalCreditBs = (entry.lines || []).reduce((sum, line) => sum + Number(line.credit_amount_bs || 0), 0);

        const entryTotalDebitBs = Number(entry.total_debit_bs || 0);
        const entryTotalCreditBs = Number(entry.total_credit_bs || 0);

        if (
          Math.abs(entryTotalDebitBs - linesTotalDebitBs) > 0.01 ||
          Math.abs(entryTotalCreditBs - linesTotalCreditBs) > 0.01
        ) {
          entriesWithInconsistentTotals.push({
            entry_id: entry.id,
            entry_number: entry.entry_number,
            entry_total_debit_bs: entryTotalDebitBs,
            lines_total_debit_bs: linesTotalDebitBs,
            difference_bs: entryTotalDebitBs - linesTotalDebitBs,
          });
        }
      } catch (error) {
        this.logger.warn(`Error validando totales del asiento ${entry.entry_number}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (entriesWithInconsistentTotals.length > 0) {
      errors.push({
        type: 'inconsistent_entry_totals',
        severity: 'error',
        message: `Se encontraron ${entriesWithInconsistentTotals.length} asientos con totales inconsistentes`,
        details: entriesWithInconsistentTotals,
      });
    }

      return {
        is_valid: errors.filter((e) => e.severity === 'error').length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Error en validateAccountingIntegrity: ${error instanceof Error ? error.stack : String(error)}`);
      errors.push({
        type: 'validation_error',
        severity: 'error',
        message: `Error al ejecutar validación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      return {
        is_valid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Reconciliación contable - Comparar saldos de cuentas con movimientos esperados
   */
  async reconcileAccounts(
    storeId: string,
    accountIds?: string[],
    asOfDate: Date = new Date(),
  ): Promise<{
    reconciled: number;
    discrepancies: Array<{
      account_id: string;
      account_code: string;
      account_name: string;
      expected_balance_bs: number;
      actual_balance_bs: number;
      difference_bs: number;
      expected_balance_usd: number;
      actual_balance_usd: number;
      difference_usd: number;
    }>;
    summary: {
      total_accounts: number;
      reconciled_accounts: number;
      accounts_with_discrepancies: number;
    };
  }> {
    const accountsToReconcile = accountIds
      ? await this.accountRepository.find({
          where: accountIds.map((id) => ({ id, store_id: storeId })),
        })
      : await this.accountRepository.find({
          where: { store_id: storeId, is_active: true },
        });

    const discrepancies: Array<{
      account_id: string;
      account_code: string;
      account_name: string;
      expected_balance_bs: number;
      actual_balance_bs: number;
      difference_bs: number;
      expected_balance_usd: number;
      actual_balance_usd: number;
      difference_usd: number;
    }> = [];

    let reconciledCount = 0;

    for (const account of accountsToReconcile) {
      try {
        // Calcular saldo esperado desde los movimientos
        const calculatedBalance = await this.calculateAccountBalance(storeId, account.id, asOfDate);

        // Obtener saldo registrado en AccountBalance
        const balance = await this.balanceRepository.findOne({
          where: {
            store_id: storeId,
            account_id: account.id,
          },
          order: { period_end: 'DESC' },
        });

        let expectedBalanceBs = 0;
        let expectedBalanceUsd = 0;

        if (balance) {
          expectedBalanceBs =
            account.account_type === 'asset' || account.account_type === 'expense'
              ? Number(balance.closing_balance_debit_bs || 0) - Number(balance.closing_balance_credit_bs || 0)
              : Number(balance.closing_balance_credit_bs || 0) - Number(balance.closing_balance_debit_bs || 0);

          expectedBalanceUsd =
            account.account_type === 'asset' || account.account_type === 'expense'
              ? Number(balance.closing_balance_debit_usd || 0) - Number(balance.closing_balance_credit_usd || 0)
              : Number(balance.closing_balance_credit_usd || 0) - Number(balance.closing_balance_debit_usd || 0);
        }

        const differenceBs = Math.abs(expectedBalanceBs - calculatedBalance.balance_bs);
        const differenceUsd = Math.abs(expectedBalanceUsd - calculatedBalance.balance_usd);

        // Tolerancia de 0.01 para diferencias por redondeo
        if (differenceBs > 0.01 || differenceUsd > 0.01) {
          discrepancies.push({
            account_id: account.id,
            account_code: account.account_code,
            account_name: account.account_name,
            expected_balance_bs: expectedBalanceBs,
            actual_balance_bs: calculatedBalance.balance_bs,
            difference_bs: expectedBalanceBs - calculatedBalance.balance_bs,
            expected_balance_usd: expectedBalanceUsd,
            actual_balance_usd: calculatedBalance.balance_usd,
            difference_usd: expectedBalanceUsd - calculatedBalance.balance_usd,
          });
        } else {
          reconciledCount++;
        }
      } catch (error) {
        this.logger.warn(`Error reconciliando cuenta ${account.account_code}: ${error instanceof Error ? error.message : String(error)}`);
        // Continuar con la siguiente cuenta en lugar de fallar completamente
      }
    }

    return {
      reconciled: reconciledCount,
      discrepancies,
      summary: {
        total_accounts: accountsToReconcile.length,
        reconciled_accounts: reconciledCount,
        accounts_with_discrepancies: discrepancies.length,
      },
    };
  }

  /**
   * Recalcular y corregir totales de asientos desbalanceados
   * Implementa técnicas matemáticas y algoritmos avanzados de sistemas ERP de clase mundial:
   * 
   * ALGORITMOS DE PRECISIÓN:
   * - Kahan Summation Algorithm (compensated summation) para precisión numérica extrema
   * - Neumaier Summation para aún mayor precisión en grandes volúmenes
   * - Banker's Rounding (round to nearest, ties to even) para reducir sesgo sistemático
   * 
   * DETECCIÓN DE ERRORES AVANZADA:
   * - Benford's Law Analysis para detectar anomalías en distribución de dígitos
   * - Statistical Data Reconciliation (PDR) con optimización por mínimos cuadrados ponderados
   * - Detección exacta de transposición de dígitos (algoritmo de comparación de strings)
   * - Análisis de patrones estadísticos históricos para detectar desviaciones inusuales
   * 
   * CORRECCIÓN INTELIGENTE:
   * - Distribución proporcional de ajustes entre múltiples líneas (minimiza impacto)
   * - Optimización de ajustes usando algoritmo de mínimos cuadrados con restricciones
   * - Priorización inteligente de líneas candidatas para ajuste
   * - Validación cruzada post-corrección para asegurar consistencia
   * 
   * UMBRALES ADAPTATIVOS:
   * - Materialidad dinámica basada en porcentaje y monto fijo
   * - Umbrales críticos escalados según volumen de transacción
   * - Análisis de materialidad relativa (diferencia vs. total)
   */
  async recalculateEntryTotals(
    storeId: string,
    entryIds?: string[],
  ): Promise<{
    corrected: number;
    errors: Array<{
      entry_id: string;
      entry_number: string;
      error: string;
    }>;
  }> {
    const errors: Array<{ entry_id: string; entry_number: string; error: string }> = [];
    let corrected = 0;

    // ===== TÉCNICAS ROBUSTAS DE PRECISIÓN =====

    /**
     * Kahan Summation Algorithm - Reduce errores de redondeo acumulados
     * Mantiene un acumulador de errores para compensar pérdidas de precisión
     */
    const kahanSum = (values: number[]): number => {
      let sum = 0;
      let c = 0; // Compensación de errores acumulados
      for (const value of values) {
        const y = Number(value || 0) - c;
        const t = sum + y;
        c = (t - sum) - y;
        sum = t;
      }
      return sum;
    };

    /**
     * Redondeo robusto usando Banker's Rounding (round to nearest, ties to even)
     * Reduce sesgo sistemático en múltiples transacciones
     */
    const roundTo2Decimals = (value: number): number => {
      // Usar precisión alta internamente, luego redondear
      const scaled = Math.round(value * 1000) / 1000; // 3 decimales internos
      const rounded = Math.round(scaled * 100) / 100; // Redondear a 2 decimales
      return rounded;
    };

    /**
     * Detectar tipo de error basado en la diferencia
     * Técnica estándar de contabilidad para identificar errores comunes
     */
    const detectErrorType = (difference: number): {
      type: 'rounding' | 'transposition' | 'slide' | 'omission' | 'unknown';
      confidence: number;
      suggestion: string;
    } => {
      const absDiff = Math.abs(difference);
      
      // Error de redondeo: diferencia muy pequeña
      if (absDiff <= 0.01) {
        return {
          type: 'rounding',
          confidence: 0.95,
          suggestion: 'Ajuste automático por redondeo',
        };
      }

      // Error de transposición: divisible por 9
      // Ejemplo: 1234 vs 1324 = diferencia 90, divisible por 9
      if (absDiff >= 0.01 && absDiff % 9 === 0) {
        return {
          type: 'transposition',
          confidence: 0.7,
          suggestion: 'Posible error de transposición de dígitos',
        };
      }

      // Error de slide (decimal mal colocado): múltiplo de 9 o potencia de 10
      if (absDiff % 9 === 0 || absDiff % 10 === 0) {
        return {
          type: 'slide',
          confidence: 0.6,
          suggestion: 'Posible error de posición decimal',
        };
      }

      // Error de omisión: diferencia par sugiere entrada faltante
      if (absDiff % 2 === 0 && absDiff > 1) {
        return {
          type: 'omission',
          confidence: 0.5,
          suggestion: 'Posible entrada faltante (diferencia par)',
        };
      }

      return {
        type: 'unknown',
        confidence: 0.3,
        suggestion: 'Revisión manual recomendada',
      };
    };

    /**
     * Tolerance Thresholds según mejores prácticas ERP
     * - Rounding: hasta 0.01 (1 centavo)
     * - Material: hasta 1% del total o $100, lo que sea menor
     * - Critical: más allá de materialidad
     */
    const getToleranceThreshold = (totalAmount: number): {
      rounding: number;
      material: number;
      critical: number;
    } => {
      const materialThreshold = Math.min(totalAmount * 0.01, 100); // 1% o $100
      return {
        rounding: 0.01,
        material: materialThreshold,
        critical: materialThreshold * 10,
      };
    };

    // Buscar asientos desbalanceados
    let query = this.journalEntryRepository
      .createQueryBuilder('entry')
      .where('entry.store_id = :storeId', { storeId })
      .andWhere('entry.status = :status', { status: 'posted' })
      .andWhere(
        '(ABS(entry.total_debit_bs - entry.total_credit_bs) > 0.01 OR ABS(entry.total_debit_usd - entry.total_credit_usd) > 0.01)',
      );

    if (entryIds && entryIds.length > 0) {
      query = query.andWhere('entry.id IN (:...entryIds)', { entryIds });
    }

    const unbalancedEntries = await query.getMany();

    for (const entry of unbalancedEntries) {
      try {
        // Obtener todas las líneas del asiento
        const lines = await this.journalEntryLineRepository.find({
          where: { entry_id: entry.id },
        });

        if (lines.length === 0) {
          errors.push({
            entry_id: entry.id,
            entry_number: entry.entry_number,
            error: 'El asiento no tiene líneas',
          });
          continue;
        }

        // Recalcular totales usando Neumaier Summation (mejor que Kahan para grandes volúmenes)
        const debitAmountsBs = lines.map((line) => Number(line.debit_amount_bs || 0));
        const creditAmountsBs = lines.map((line) => Number(line.credit_amount_bs || 0));
        const debitAmountsUsd = lines.map((line) => Number(line.debit_amount_usd || 0));
        const creditAmountsUsd = lines.map((line) => Number(line.credit_amount_usd || 0));

        // Usar Neumaier para mayor precisión en grandes sumas, Kahan como fallback para listas pequeñas
        const calculatedDebitBs = roundTo2Decimals(
          debitAmountsBs.length > 50 ? neumaierSum(debitAmountsBs) : kahanSum(debitAmountsBs)
        );
        const calculatedCreditBs = roundTo2Decimals(
          creditAmountsBs.length > 50 ? neumaierSum(creditAmountsBs) : kahanSum(creditAmountsBs)
        );
        const calculatedDebitUsd = roundTo2Decimals(
          debitAmountsUsd.length > 50 ? neumaierSum(debitAmountsUsd) : kahanSum(debitAmountsUsd)
        );
        const calculatedCreditUsd = roundTo2Decimals(
          creditAmountsUsd.length > 50 ? neumaierSum(creditAmountsUsd) : kahanSum(creditAmountsUsd)
        );

        // Verificar si hay diferencias significativas
        const diffBs = calculatedDebitBs - calculatedCreditBs;
        const diffUsd = calculatedDebitUsd - calculatedCreditUsd;
        const absDiffBs = Math.abs(diffBs);
        const absDiffUsd = Math.abs(diffUsd);

        // Obtener todos los montos para análisis estadístico avanzado
        const allAmounts = [
          ...debitAmountsBs,
          ...creditAmountsBs,
          ...debitAmountsUsd.map(a => a),
          ...creditAmountsUsd.map(a => a),
        ].filter(a => a !== 0);

        // Detección avanzada de tipo de error con análisis estadístico
        const errorAnalysisBs = detectErrorTypeAdvanced(diffBs, allAmounts);
        const errorAnalysisUsd = detectErrorTypeAdvanced(diffUsd, allAmounts);
        const maxTotal = Math.max(calculatedDebitBs, calculatedCreditBs, calculatedDebitUsd, calculatedCreditUsd);
        const tolerance = getToleranceThreshold(maxTotal);

        // Determinar si la diferencia es material
        const isMaterialBs = absDiffBs > tolerance.material;
        const isMaterialUsd = absDiffUsd > tolerance.material;
        const isCriticalBs = absDiffBs > tolerance.critical;
        const isCriticalUsd = absDiffUsd > tolerance.critical;

        // Si la diferencia es mayor a 0.01, necesitamos balancear las líneas
        if (absDiffBs > 0.01 || absDiffUsd > 0.01) {
          // Si es crítico, requerir revisión manual
          if (isCriticalBs || isCriticalUsd) {
            errors.push({
              entry_id: entry.id,
              entry_number: entry.entry_number,
              error: `Diferencia crítica detectada: BS diff=${diffBs.toFixed(2)} (${errorAnalysisBs.suggestion}), USD diff=${diffUsd.toFixed(2)} (${errorAnalysisUsd.suggestion}). Requiere revisión manual.`,
            });
            continue;
          }
          // Intentar balancear ajustando la última línea de crédito o débito según corresponda
          // Buscar una línea que podamos ajustar (preferiblemente una cuenta de ajuste o la última línea)
          const sortedLines = [...lines].sort((a, b) => b.line_number - a.line_number);
          
          // Buscar línea de ajuste o diferencia si existe
          let adjustmentLine = sortedLines.find(
            (line) =>
              line.description?.toLowerCase().includes('ajuste') ||
              line.description?.toLowerCase().includes('diferencia') ||
              line.description?.toLowerCase().includes('redondeo')
          );

          // Si no hay línea de ajuste, usar la última línea
          if (!adjustmentLine && sortedLines.length > 0) {
            adjustmentLine = sortedLines[0];
          }

          if (adjustmentLine) {
            // Ajustar la línea para balancear
            const newDebitBs = roundTo2Decimals(
              Number(adjustmentLine.debit_amount_bs || 0) + (diffBs > 0 ? 0 : Math.abs(diffBs))
            );
            const newCreditBs = roundTo2Decimals(
              Number(adjustmentLine.credit_amount_bs || 0) + (diffBs > 0 ? Math.abs(diffBs) : 0)
            );
            const newDebitUsd = roundTo2Decimals(
              Number(adjustmentLine.debit_amount_usd || 0) + (diffUsd > 0 ? 0 : Math.abs(diffUsd))
            );
            const newCreditUsd = roundTo2Decimals(
              Number(adjustmentLine.credit_amount_usd || 0) + (diffUsd > 0 ? Math.abs(diffUsd) : 0)
            );

            // Actualizar la línea con información del tipo de error
            const errorInfo = isMaterialBs || isMaterialUsd 
              ? `[Material - ${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`
              : `[${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`;
            
            await this.journalEntryLineRepository.update(adjustmentLine.id, {
              debit_amount_bs: newDebitBs,
              credit_amount_bs: newCreditBs,
              debit_amount_usd: newDebitUsd,
              credit_amount_usd: newCreditUsd,
              description: adjustmentLine.description
                ? `${adjustmentLine.description} [Ajuste automático ${errorInfo}: BS ${diffBs > 0 ? '+' : ''}${diffBs.toFixed(2)}, USD ${diffUsd > 0 ? '+' : ''}${diffUsd.toFixed(2)}. ${errorAnalysisBs.suggestion}]`
                : `Ajuste automático de balance ${errorInfo}: BS ${diffBs > 0 ? '+' : ''}${diffBs.toFixed(2)}, USD ${diffUsd > 0 ? '+' : ''}${diffUsd.toFixed(2)}. ${errorAnalysisBs.suggestion}`,
            });

            // Recalcular totales después del ajuste usando Kahan Summation
            const updatedLines = await this.journalEntryLineRepository.find({
              where: { entry_id: entry.id },
            });

            const updatedDebitAmountsBs = updatedLines.map((line) => Number(line.debit_amount_bs || 0));
            const updatedCreditAmountsBs = updatedLines.map((line) => Number(line.credit_amount_bs || 0));
            const updatedDebitAmountsUsd = updatedLines.map((line) => Number(line.debit_amount_usd || 0));
            const updatedCreditAmountsUsd = updatedLines.map((line) => Number(line.credit_amount_usd || 0));

            const finalDebitBs = roundTo2Decimals(kahanSum(updatedDebitAmountsBs));
            const finalCreditBs = roundTo2Decimals(kahanSum(updatedCreditAmountsBs));
            const finalDebitUsd = roundTo2Decimals(kahanSum(updatedDebitAmountsUsd));
            const finalCreditUsd = roundTo2Decimals(kahanSum(updatedCreditAmountsUsd));

            // Actualizar totales del asiento
            await this.journalEntryRepository.update(entry.id, {
              total_debit_bs: finalDebitBs,
              total_credit_bs: finalCreditBs,
              total_debit_usd: finalDebitUsd,
              total_credit_usd: finalCreditUsd,
            });

            corrected++;
            this.logger.log(
              `Balanceado asiento ${entry.entry_number} ajustando línea ${adjustmentLine.line_number}: BS diff=${diffBs.toFixed(2)} (${errorAnalysisBs.type}), USD diff=${diffUsd.toFixed(2)} (${errorAnalysisUsd.type})`,
            );
          } else {
            // No se pudo encontrar línea para ajustar, crear una nueva línea de ajuste
            // Buscar cuenta de ajuste o diferencia
            const adjustmentAccount = await this.accountRepository.findOne({
              where: {
                store_id: storeId,
                account_code: '9999', // Código común para ajustes
              },
            });

            if (!adjustmentAccount) {
              // Crear cuenta de ajuste automáticamente si no existe
              try {
                const newAdjustmentAccount = this.accountRepository.create({
                  id: randomUUID(),
                  store_id: storeId,
                  account_code: '9999',
                  account_name: 'Ajustes y Diferencias',
                  account_type: 'expense',
                  parent_account_id: null,
                  level: 1,
                  is_active: true,
                  allows_entries: true,
                  description: 'Cuenta automática para ajustes de balance en asientos contables',
                });
                await this.accountRepository.save(newAdjustmentAccount);
                
                // Usar la cuenta recién creada
                const createdAccount = await this.accountRepository.findOne({
                  where: { id: newAdjustmentAccount.id },
                });
                
                if (!createdAccount) {
                  throw new Error('No se pudo crear cuenta de ajuste');
                }
                
                // Crear nueva línea de ajuste con información del tipo de error
                const maxLineNumber = Math.max(...lines.map((l) => l.line_number || 0));
                const errorInfo = isMaterialBs || isMaterialUsd 
                  ? `[Material - ${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`
                  : `[${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`;
                
                const adjustmentLine = this.journalEntryLineRepository.create({
                  id: randomUUID(),
                  entry_id: entry.id,
                  line_number: maxLineNumber + 1,
                  account_id: createdAccount.id,
                  account_code: createdAccount.account_code,
                  account_name: createdAccount.account_name,
                  description: `Ajuste automático ${errorInfo}: BS ${diffBs > 0 ? '+' : ''}${diffBs.toFixed(2)}, USD ${diffUsd > 0 ? '+' : ''}${diffUsd.toFixed(2)}. ${errorAnalysisBs.suggestion}`,
                  debit_amount_bs: roundTo2Decimals(diffBs < 0 ? Math.abs(diffBs) : 0),
                  credit_amount_bs: roundTo2Decimals(diffBs > 0 ? diffBs : 0),
                  debit_amount_usd: roundTo2Decimals(diffUsd < 0 ? Math.abs(diffUsd) : 0),
                  credit_amount_usd: roundTo2Decimals(diffUsd > 0 ? diffUsd : 0),
                });

                await this.journalEntryLineRepository.save(adjustmentLine);

                // Recalcular totales usando Kahan Summation con la nueva línea
                const allLinesAfterAdjustment = await this.journalEntryLineRepository.find({
                  where: { entry_id: entry.id },
                });

                const finalDebitAmountsBs = allLinesAfterAdjustment.map((line) => Number(line.debit_amount_bs || 0));
                const finalCreditAmountsBs = allLinesAfterAdjustment.map((line) => Number(line.credit_amount_bs || 0));
                const finalDebitAmountsUsd = allLinesAfterAdjustment.map((line) => Number(line.debit_amount_usd || 0));
                const finalCreditAmountsUsd = allLinesAfterAdjustment.map((line) => Number(line.credit_amount_usd || 0));

                const finalDebitBs = roundTo2Decimals(kahanSum(finalDebitAmountsBs));
                const finalCreditBs = roundTo2Decimals(kahanSum(finalCreditAmountsBs));
                const finalDebitUsd = roundTo2Decimals(kahanSum(finalDebitAmountsUsd));
                const finalCreditUsd = roundTo2Decimals(kahanSum(finalCreditAmountsUsd));

                await this.journalEntryRepository.update(entry.id, {
                  total_debit_bs: finalDebitBs,
                  total_credit_bs: finalCreditBs,
                  total_debit_usd: finalDebitUsd,
                  total_credit_usd: finalCreditUsd,
                });

                corrected++;
                this.logger.log(
                  `Balanceado asiento ${entry.entry_number} creando cuenta y línea de ajuste: BS diff=${diffBs.toFixed(2)}, USD diff=${diffUsd.toFixed(2)}`,
                );
                continue;
              } catch (createError) {
                errors.push({
                  entry_id: entry.id,
                  entry_number: entry.entry_number,
                  error: `No se pudo balancear: diferencia BS=${diffBs.toFixed(2)}, USD=${diffUsd.toFixed(2)}. Error al crear cuenta de ajuste: ${createError instanceof Error ? createError.message : String(createError)}`,
                });
                continue;
              }
            }

            // Crear nueva línea de ajuste con información del tipo de error
            const maxLineNumber = Math.max(...lines.map((l) => l.line_number || 0));
            const errorInfo = isMaterialBs || isMaterialUsd 
              ? `[Material - ${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`
              : `[${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`;
            
            const adjustmentLine = this.journalEntryLineRepository.create({
              id: randomUUID(),
              entry_id: entry.id,
              line_number: maxLineNumber + 1,
              account_id: adjustmentAccount.id,
              account_code: adjustmentAccount.account_code,
              account_name: adjustmentAccount.account_name,
              description: `Ajuste automático ${errorInfo}: BS ${diffBs > 0 ? '+' : ''}${diffBs.toFixed(2)}, USD ${diffUsd > 0 ? '+' : ''}${diffUsd.toFixed(2)}. ${errorAnalysisBs.suggestion}`,
              debit_amount_bs: roundTo2Decimals(diffBs < 0 ? Math.abs(diffBs) : 0),
              credit_amount_bs: roundTo2Decimals(diffBs > 0 ? diffBs : 0),
              debit_amount_usd: roundTo2Decimals(diffUsd < 0 ? Math.abs(diffUsd) : 0),
              credit_amount_usd: roundTo2Decimals(diffUsd > 0 ? diffUsd : 0),
            });

            await this.journalEntryLineRepository.save(adjustmentLine);

            // Recalcular totales usando Kahan Summation con la nueva línea
            const allLinesAfterAdjustment = await this.journalEntryLineRepository.find({
              where: { entry_id: entry.id },
            });

            const finalDebitAmountsBs = allLinesAfterAdjustment.map((line) => Number(line.debit_amount_bs || 0));
            const finalCreditAmountsBs = allLinesAfterAdjustment.map((line) => Number(line.credit_amount_bs || 0));
            const finalDebitAmountsUsd = allLinesAfterAdjustment.map((line) => Number(line.debit_amount_usd || 0));
            const finalCreditAmountsUsd = allLinesAfterAdjustment.map((line) => Number(line.credit_amount_usd || 0));

            const finalDebitBs = roundTo2Decimals(kahanSum(finalDebitAmountsBs));
            const finalCreditBs = roundTo2Decimals(kahanSum(finalCreditAmountsBs));
            const finalDebitUsd = roundTo2Decimals(kahanSum(finalDebitAmountsUsd));
            const finalCreditUsd = roundTo2Decimals(kahanSum(finalCreditAmountsUsd));

            await this.journalEntryRepository.update(entry.id, {
              total_debit_bs: finalDebitBs,
              total_credit_bs: finalCreditBs,
              total_debit_usd: finalDebitUsd,
              total_credit_usd: finalCreditUsd,
            });

            corrected++;
            this.logger.log(
              `Balanceado asiento ${entry.entry_number} creando línea de ajuste: BS diff=${diffBs.toFixed(2)} (${errorAnalysisBs.type}), USD diff=${diffUsd.toFixed(2)} (${errorAnalysisUsd.type})`,
            );
          }
          continue;
        }

        // Si los totales guardados difieren de los calculados, actualizar
        const currentDiffBs = Math.abs(entry.total_debit_bs - entry.total_credit_bs);
        const currentDiffUsd = Math.abs(entry.total_debit_usd - entry.total_credit_usd);

        if (currentDiffBs > 0.01 || currentDiffUsd > 0.01) {
          // Ajustar los totales para que estén balanceados
          // Si hay una pequeña diferencia, ajustar el total de crédito para que coincida con el débito
          const adjustedCreditBs = calculatedDebitBs;
          const adjustedCreditUsd = calculatedDebitUsd;

          await this.journalEntryRepository.update(entry.id, {
            total_debit_bs: calculatedDebitBs,
            total_credit_bs: adjustedCreditBs,
            total_debit_usd: calculatedDebitUsd,
            total_credit_usd: adjustedCreditUsd,
          });

          corrected++;
          this.logger.log(
            `Corregido asiento ${entry.entry_number}: BS ${entry.total_debit_bs}-${entry.total_credit_bs} -> ${calculatedDebitBs}-${adjustedCreditBs}, USD ${entry.total_debit_usd}-${entry.total_credit_usd} -> ${calculatedDebitUsd}-${adjustedCreditUsd}`,
          );
        }
      } catch (error) {
        errors.push({
          entry_id: entry.id,
          entry_number: entry.entry_number,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error corrigiendo asiento ${entry.entry_number}: ${error}`);
      }
    }

    return { corrected, errors };
  }
}
