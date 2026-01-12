import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull } from 'typeorm';
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
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(InventoryMovement)
    private inventoryMovementRepository: Repository<InventoryMovement>,
    @InjectRepository(ProductLot)
    private productLotRepository: Repository<ProductLot>,
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

      // Calcular costo real desde sale_items
      const saleItems = await this.saleItemRepository.find({
        where: { sale_id: sale.id },
        relations: ['lot', 'product'],
      });

      let costBs = 0;
      let costUsd = 0;

      for (const item of saleItems) {
        let itemCostBs = 0;
        let itemCostUsd = 0;

        // Si tiene lote, usar costo del lote
        if (item.lot_id && item.lot) {
          itemCostBs = Number(item.lot.unit_cost_bs || 0) * item.qty;
          itemCostUsd = Number(item.lot.unit_cost_usd || 0) * item.qty;
        } else {
          // Buscar costo en movimientos de inventario más recientes (promedio ponderado)
          const movements = await this.inventoryMovementRepository.find({
            where: {
              store_id: storeId,
              product_id: item.product_id,
              variant_id: item.variant_id ? item.variant_id : IsNull(),
              movement_type: 'received',
              approved: true,
            },
            order: { happened_at: 'DESC' },
            take: 10, // Últimos 10 movimientos para calcular promedio
          });

          if (movements.length > 0) {
            // Calcular promedio ponderado
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
              const avgCostBs = totalCostBs / totalQty;
              const avgCostUsd = totalCostUsd / totalQty;
              itemCostBs = avgCostBs * item.qty;
              itemCostUsd = avgCostUsd * item.qty;
            } else {
              // Fallback: usar costo del producto
              itemCostBs = Number(item.product?.cost_bs || 0) * item.qty;
              itemCostUsd = Number(item.product?.cost_usd || 0) * item.qty;
            }
          } else {
            // Fallback: usar costo del producto
            itemCostBs = Number(item.product?.cost_bs || 0) * item.qty;
            itemCostUsd = Number(item.product?.cost_usd || 0) * item.qty;
          }
        }

        costBs += itemCostBs;
        costUsd += itemCostUsd;
      }

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

      // Obtener mapeos de cuentas
      const revenueMapping = await this.getAccountMapping(storeId, 'sale_revenue', null);
      const taxMapping = await this.getAccountMapping(storeId, 'sale_tax', null);
      const receivableMapping = await this.getAccountMapping(storeId, 'accounts_receivable', null);
      const cashMapping = await this.getAccountMapping(storeId, 'cash_asset', null);

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

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: 'invoice',
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
}
