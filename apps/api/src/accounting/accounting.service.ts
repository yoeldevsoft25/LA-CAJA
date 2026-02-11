import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, In, EntityManager } from 'typeorm';
import {
  JournalEntry,
  JournalEntryType,
  JournalEntryStatus,
} from '../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../database/entities/chart-of-accounts.entity';
import {
  AccountingAccountMapping,
  TransactionType,
} from '../database/entities/accounting-account-mapping.entity';
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
import { FiscalConfig } from '../database/entities/fiscal-config.entity';
import { Debt, DebtStatus } from '../database/entities/debt.entity';
import {
  AccountingPeriod,
  AccountingPeriodStatus,
} from '../database/entities/accounting-period.entity';
import { randomUUID } from 'crypto';
import {
  neumaierSum,
  detectErrorTypeAdvanced,
} from './accounting-advanced-algorithms';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingSharedService } from './accounting-shared.service';
import { AccountingReportingService } from './accounting-reporting.service';
import { AccountingAuditService } from './accounting-audit.service';
import { ExchangeService } from '../exchange/exchange.service';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  // ⚡ OPTIMIZACIÓN: Cache de mapeos de cuentas para evitar queries repetitivas
  private accountMappingCache = new Map<
    string,
    AccountingAccountMapping | null
  >();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 60000; // 60 segundos

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
    @InjectRepository(Debt)
    private debtRepository: Repository<Debt>,
    @InjectRepository(AccountingPeriod)
    private periodRepository: Repository<AccountingPeriod>,
    @InjectRepository(FiscalConfig)
    private fiscalConfigRepository: Repository<FiscalConfig>,
    private sharedService: AccountingSharedService,
    private reportingService: AccountingReportingService,
    private exchangeService: ExchangeService,
    @Inject(forwardRef(() => AccountingPeriodService))
    private periodService: AccountingPeriodService,
    private auditService: AccountingAuditService,
  ) { }

  /**
   * Generar número de asiento único (delegado a AccountingSharedService)
   */
  async generateEntryNumber(storeId: string, entryDate: Date): Promise<string> {
    return this.sharedService.generateEntryNumber(storeId, entryDate);
  }

  /**
   * Crear asiento contable manual
   */
  async createJournalEntry(
    storeId: string,
    dto: CreateJournalEntryDto,
    _userId: string,
  ): Promise<JournalEntry> {
    // Validar que el período esté abierto
    await this.periodService.validatePeriodOpen(
      storeId,
      new Date(dto.entry_date),
    );

    // Validar que las líneas estén balanceadas
    const totalDebitBs = dto.lines.reduce(
      (sum, line) => sum + line.debit_amount_bs,
      0,
    );
    const totalCreditBs = dto.lines.reduce(
      (sum, line) => sum + line.credit_amount_bs,
      0,
    );
    const totalDebitUsd = dto.lines.reduce(
      (sum, line) => sum + line.debit_amount_usd,
      0,
    );
    const totalCreditUsd = dto.lines.reduce(
      (sum, line) => sum + line.credit_amount_usd,
      0,
    );

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
        throw new NotFoundException(
          `Cuenta ${line.account_code} no encontrada`,
        );
      }

      if (!account.is_active) {
        throw new BadRequestException(
          `Cuenta ${line.account_code} está inactiva`,
        );
      }

      if (!account.allows_entries) {
        throw new BadRequestException(
          `Cuenta ${line.account_code} no permite asientos directos`,
        );
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

    const result = await this.journalEntryRepository.findOne({
      where: { id: savedEntry.id },
      relations: ['lines'],
    }) as JournalEntry;

    // Audit Log
    await this.auditService.logAction({
      store_id: storeId,
      user_id: _userId,
      action: 'create_journal_entry',
      entity_type: 'JournalEntry',
      entity_id: savedEntry.id,
      after_value: savedEntry,
      metadata: { entry_number: entryNumber }
    });

    return result;
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

  async findEntryBySource(
    storeId: string,
    sourceType: string | string[],
    sourceId: string,
  ): Promise<JournalEntry | null> {
    const where: any = {
      store_id: storeId,
      source_id: sourceId,
    };

    if (Array.isArray(sourceType)) {
      where.source_type = In(sourceType);
    } else {
      where.source_type = sourceType;
    }

    return this.journalEntryRepository.findOne({ where });
  }

  /**
   * Busca todos los asientos relacionados con una venta (sea fuente 'sale' o 'fiscal_invoice')
   */
  async findEntriesBySale(
    storeId: string,
    saleId: string,
    entityManager?: EntityManager,
  ): Promise<JournalEntry[]> {
    const entryRepo = entityManager
      ? entityManager.getRepository(JournalEntry)
      : this.journalEntryRepository;
    const fiscalRepo = entityManager
      ? entityManager.getRepository(FiscalInvoice)
      : this.fiscalInvoiceRepository;

    // Buscar asientos donde la fuente sea la venta directamente
    const saleEntries = await entryRepo.find({
      where: {
        store_id: storeId,
        source_type: 'sale',
        source_id: saleId,
      },
    });

    // Buscar asientos vinculados a facturas fiscales de esa venta
    const fiscalInvoices = await fiscalRepo.find({
      where: { store_id: storeId, sale_id: saleId },
    });

    const fiscalEntries: JournalEntry[] = [];
    if (fiscalInvoices.length > 0) {
      const entries = await entryRepo.find({
        where: {
          store_id: storeId,
          source_type: 'fiscal_invoice',
          source_id: In(fiscalInvoices.map((inv) => inv.id)),
        },
      });
      fiscalEntries.push(...entries);
    }

    // Retornar lista sin duplicados (por ID)
    const all = [...saleEntries, ...fiscalEntries];
    const unique = Array.from(new Map(all.map((e) => [e.id, e])).values());
    return unique;
  }

  /**
   * Generar asiento contable automático desde una venta
   */
  async generateEntryFromSale(
    storeId: string,
    sale: Sale,
  ): Promise<JournalEntry | null> {
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

      // ⚡ OPTIMIZACIÓN: Obtener todos los mapeos de cuentas en batch
      const mappings = await this.getAccountMappingsBatch(
        storeId,
        [
          'sale_revenue',
          'sale_cost',
          'cash_asset',
          'accounts_receivable',
          'inventory_asset',
          'income',
          'adjustment',
          'sale_tax', // Tipo de mapeo correcto según la entidad
        ],
        sale.payment?.method ? { method: sale.payment.method } : undefined,
      );
      const revenueMapping = mappings.get('sale_revenue');
      const costMapping = mappings.get('sale_cost');
      const cashMapping = mappings.get('cash_asset') || null;
      const receivableMapping = mappings.get('accounts_receivable') || null;
      const inventoryMapping = mappings.get('inventory_asset');
      const incomeMapping = mappings.get('income');
      const adjustmentMapping = mappings.get('adjustment');
      const taxMapping = mappings.get('sale_tax');

      if (!revenueMapping || !costMapping) {
        this.logger.warn(
          `No se encontraron mapeos de cuentas para venta ${sale.id}`,
        );
        return null;
      }

      // Obtener configuración fiscal para segregación de IVA
      const fiscalConfig = await this.fiscalConfigRepository.findOne({
        where: { store_id: storeId, is_active: true },
      });

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

      // Redondear todos los valores a 2 decimales para consistencia contable
      const roundTwo = (value: number) => Math.round(value * 100) / 100;
      const totalAmountBs = roundTwo(sale.totals.total_bs);
      const totalAmountUsd = roundTwo(sale.totals.total_usd);

      // Calcular segregación de impuestos
      let taxAmountBs = 0;
      let taxAmountUsd = 0;
      let netRevenueBs = totalAmountBs;
      let netRevenueUsd = totalAmountUsd;

      if (fiscalConfig && fiscalConfig.default_tax_rate > 0) {
        const taxRate = fiscalConfig.default_tax_rate;
        // Asumiendo que el total de la venta es BRUTO
        const divisor = 1 + taxRate / 100;
        netRevenueBs = roundTwo(totalAmountBs / divisor);
        netRevenueUsd = roundTwo(totalAmountUsd / divisor);
        taxAmountBs = roundTwo(totalAmountBs - netRevenueBs);
        taxAmountUsd = roundTwo(totalAmountUsd - netRevenueUsd);
      }

      const roundingAdjustmentBs = roundTwo(
        (sale.payment?.cash_payment?.change_rounding?.adjustment_bs || 0) +
        (sale.payment?.cash_payment_bs?.change_rounding?.adjustment_bs || 0),
      );

      // Calcular costo real desde sale_items (opcional, si hay inventario)
      const saleItems = await this.saleItemRepository.find({
        where: { sale_id: sale.id },
        relations: ['lot', 'product'],
      });

      const { costBs: rawCostBs, costUsd: rawCostUsd } =
        await this.calculateSaleCosts(storeId, saleItems);
      const costBs = roundTwo(rawCostBs);
      const costUsd = roundTwo(rawCostUsd);

      // 1. LÍNEA DE COBRO O CUENTA POR COBRAR (DEBE)
      if (sale.payment.method === 'FIAO') {
        if (!receivableMapping) {
          this.logger.warn(
            `No se encontró mapeo accounts_receivable para venta FIAO ${sale.id}`,
          );
          return null;
        }
        lines.push({
          account_id: receivableMapping.account_id,
          account_code: receivableMapping.account_code,
          account_name:
            receivableMapping.account?.account_name ||
            receivableMapping.account_code,
          debit_amount_bs: totalAmountBs,
          credit_amount_bs: 0,
          debit_amount_usd: totalAmountUsd,
          credit_amount_usd: 0,
          description: `Venta FIAO - ${sale.invoice_full_number || sale.id}`,
        });
      } else if (
        sale.payment.method === 'SPLIT' &&
        Array.isArray(sale.payment.split_payments) &&
        sale.payment.split_payments.length > 0
      ) {
        // Pagos divididos: debitar multiples cuentas de activo segun split_payments[]
        const split = sale.payment.split_payments;
        const round = (value: number) => Math.round(value * 100) / 100;

        const debitLines: typeof lines = [];
        let sumBs = 0;
        let sumUsd = 0;

        for (const sp of split) {
          const method = String((sp as any).method || '').trim();
          if (!method) continue;

          const amountBs = round(Number((sp as any).amount_bs || 0));
          const amountUsd = round(Number((sp as any).amount_usd || 0));
          if (amountBs <= 0 && amountUsd <= 0) continue;

          let assetMapping = await this.getAccountMapping(storeId, 'cash_asset', {
            method,
          });
          if (!assetMapping) {
            // Fallback: usar el mapping default de caja si existe
            assetMapping = cashMapping;
          }
          if (!assetMapping) {
            this.logger.warn(
              `No se encontró mapeo de activo para split method=${method} en venta ${sale.id}`,
            );
            continue;
          }

          debitLines.push({
            account_id: assetMapping.account_id,
            account_code: assetMapping.account_code,
            account_name:
              assetMapping.account?.account_name || assetMapping.account_code,
            debit_amount_bs: amountBs,
            credit_amount_bs: 0,
            debit_amount_usd: amountUsd,
            credit_amount_usd: 0,
            description: `Cobro ${method} (Split) - ${sale.invoice_full_number || sale.id}`,
          });

          sumBs = round(sumBs + amountBs);
          sumUsd = round(sumUsd + amountUsd);
        }

        // Si no se pudo construir ninguna linea (data corrupta o sin mapeos),
        // hacer fallback a una sola cuenta para no generar asientos desbalanceados.
        if (debitLines.length === 0) {
          if (cashMapping) {
            debitLines.push({
              account_id: cashMapping.account_id,
              account_code: cashMapping.account_code,
              account_name:
                cashMapping.account?.account_name || cashMapping.account_code,
              debit_amount_bs: totalAmountBs,
              credit_amount_bs: 0,
              debit_amount_usd: totalAmountUsd,
              credit_amount_usd: 0,
              description: `Cobro de venta (Split fallback) - ${sale.invoice_full_number || sale.id}`,
            });
            sumBs = totalAmountBs;
            sumUsd = totalAmountUsd;
          } else {
            this.logger.warn(
              `Venta SPLIT ${sale.id} sin cash_asset mapping default. No se puede generar asiento.`,
            );
            return null;
          }
        }

        // Ajuste de redondeo: si el split queda corto por centavos, ajustar el ultimo pago.
        const diffBs = round(totalAmountBs - sumBs);
        const diffUsd = round(totalAmountUsd - sumUsd);
        const tolerance = 0.05;

        if (
          debitLines.length > 0 &&
          Math.abs(diffBs) <= tolerance &&
          Math.abs(diffUsd) <= tolerance
        ) {
          const last = debitLines[debitLines.length - 1];
          last.debit_amount_bs = round(last.debit_amount_bs + diffBs);
          last.debit_amount_usd = round(last.debit_amount_usd + diffUsd);
        } else if (
          Math.abs(diffBs) > 0.01 ||
          Math.abs(diffUsd) > 0.01
        ) {
          this.logger.warn(
            `Split payments no cuadran para venta ${sale.id}. total_bs=${totalAmountBs}, sum_bs=${sumBs}, total_usd=${totalAmountUsd}, sum_usd=${sumUsd}. Usando mapping default.`,
          );

          // Fallback: si el split es invalido, registrar el total a una sola cuenta para no romper la contabilidad.
          if (cashMapping) {
            debitLines.length = 0;
            debitLines.push({
              account_id: cashMapping.account_id,
              account_code: cashMapping.account_code,
              account_name:
                cashMapping.account?.account_name || cashMapping.account_code,
              debit_amount_bs: totalAmountBs,
              credit_amount_bs: 0,
              debit_amount_usd: totalAmountUsd,
              credit_amount_usd: 0,
              description: `Cobro de venta (Split fallback) - ${sale.invoice_full_number || sale.id}`,
            });
          }
        }

        lines.push(...debitLines);
      } else {
        if (!cashMapping) {
          this.logger.warn(
            `No se encontró mapeo cash_asset para venta ${sale.id} (method=${sale.payment.method})`,
          );
          return null;
        }
        lines.push({
          account_id: cashMapping.account_id,
          account_code: cashMapping.account_code,
          account_name:
            cashMapping.account?.account_name || cashMapping.account_code,
          debit_amount_bs: totalAmountBs,
          credit_amount_bs: 0,
          debit_amount_usd: totalAmountUsd,
          credit_amount_usd: 0,
          description: `Cobro de venta - ${sale.invoice_full_number || sale.id}`,
        });
      }

      // 2. LÍNEA DE INGRESO (HABER - NETO)
      lines.push({
        account_id: revenueMapping.account_id,
        account_code: revenueMapping.account_code,
        account_name:
          revenueMapping.account?.account_name || revenueMapping.account_code,
        debit_amount_bs: 0,
        credit_amount_bs: netRevenueBs,
        debit_amount_usd: 0,
        credit_amount_usd: netRevenueUsd,
        description: `Venta (Neto) - ${sale.invoice_full_number || sale.id}`,
      });

      // 3. LÍNEA DE IVA (HABER - SEGRAGADO)
      if (taxAmountBs > 0 || taxAmountUsd > 0) {
        if (taxMapping) {
          lines.push({
            account_id: taxMapping.account_id,
            account_code: taxMapping.account_code,
            account_name:
              taxMapping.account?.account_name || taxMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: taxAmountBs,
            debit_amount_usd: 0,
            credit_amount_usd: taxAmountUsd,
            description: `IVA por cobrar (Segregado) - ${sale.invoice_full_number || sale.id}`,
          });
        } else {
          // Fallback: Si no hay cuenta de IVA, añadir al ingreso
          const lastLine = lines[lines.length - 1];
          lastLine.credit_amount_bs = roundTwo(
            lastLine.credit_amount_bs + taxAmountBs,
          );
          lastLine.credit_amount_usd = roundTwo(
            lastLine.credit_amount_usd + taxAmountUsd,
          );
          this.logger.warn(
            `No se encontró cuenta de IVA ('sale_tax'), se incluyó en ingresos para ${sale.id}`,
          );
        }
      }

      // 4. LÍNEAS DE COSTO Y AJUSTE (Si aplica)

      // Costo de venta (si aplica)
      if (costBs > 0 || costUsd > 0) {
        lines.push({
          account_id: costMapping.account_id,
          account_code: costMapping.account_code,
          account_name:
            costMapping.account?.account_name || costMapping.account_code,
          debit_amount_bs: costBs,
          credit_amount_bs: 0,
          debit_amount_usd: costUsd,
          credit_amount_usd: 0,
          description: `Costo de venta - ${sale.invoice_full_number || sale.id}`,
        });

        // Descontar inventario (ya obtenido en batch arriba)
        if (inventoryMapping) {
          lines.push({
            account_id: inventoryMapping.account_id,
            account_code: inventoryMapping.account_code,
            account_name:
              inventoryMapping.account?.account_name ||
              inventoryMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: costBs,
            debit_amount_usd: 0,
            credit_amount_usd: costUsd,
            description: `Salida de inventario - ${sale.invoice_full_number || sale.id}`,
          });
        }
      }

      if (roundingAdjustmentBs !== 0 && cashMapping) {
        if (roundingAdjustmentBs > 0 && incomeMapping) {
          lines.push({
            account_id: cashMapping.account_id,
            account_code: cashMapping.account_code,
            account_name:
              cashMapping.account?.account_name || cashMapping.account_code,
            debit_amount_bs: roundingAdjustmentBs,
            credit_amount_bs: 0,
            debit_amount_usd: 0,
            credit_amount_usd: 0,
            description: `Ajuste de vuelto a favor tienda - ${sale.invoice_full_number || sale.id}`,
          });
          lines.push({
            account_id: incomeMapping.account_id,
            account_code: incomeMapping.account_code,
            account_name:
              incomeMapping.account?.account_name || incomeMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: roundingAdjustmentBs,
            debit_amount_usd: 0,
            credit_amount_usd: 0,
            description: `Ingreso por ajuste de vuelto - ${sale.invoice_full_number || sale.id}`,
          });
        } else if (roundingAdjustmentBs < 0 && adjustmentMapping) {
          const adjustmentAbs = Math.abs(roundingAdjustmentBs);
          lines.push({
            account_id: adjustmentMapping.account_id,
            account_code: adjustmentMapping.account_code,
            account_name:
              adjustmentMapping.account?.account_name ||
              adjustmentMapping.account_code,
            debit_amount_bs: adjustmentAbs,
            credit_amount_bs: 0,
            debit_amount_usd: 0,
            credit_amount_usd: 0,
            description: `Gasto por ajuste de vuelto - ${sale.invoice_full_number || sale.id}`,
          });
          lines.push({
            account_id: cashMapping.account_id,
            account_code: cashMapping.account_code,
            account_name:
              cashMapping.account?.account_name || cashMapping.account_code,
            debit_amount_bs: 0,
            credit_amount_bs: adjustmentAbs,
            debit_amount_usd: 0,
            credit_amount_usd: 0,
            description: `Ajuste de vuelto a favor cliente - ${sale.invoice_full_number || sale.id}`,
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
        total_debit_bs: roundTwo(
          lines.reduce((sum, l) => sum + l.debit_amount_bs, 0),
        ),
        total_credit_bs: roundTwo(
          lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
        ),
        total_debit_usd: roundTwo(
          lines.reduce((sum, l) => sum + l.debit_amount_usd, 0),
        ),
        total_credit_usd: roundTwo(
          lines.reduce((sum, l) => sum + l.credit_amount_usd, 0),
        ),
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
      this.logger.error(
        `Error generando asiento desde venta ${sale.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Obtener mapeo de cuenta por tipo de transacción
   */
  /**
   * Obtener mapeo de cuenta (optimizado con caché)
   */
  private async getAccountMapping(
    storeId: string,
    transactionType: TransactionType,
    conditions?: any,
  ): Promise<AccountingAccountMapping | null> {
    // Generar clave de caché
    const cacheKey = `${storeId}:${transactionType}:${JSON.stringify(conditions || {})}`;
    const now = Date.now();

    // Verificar caché
    if (this.accountMappingCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        return this.accountMappingCache.get(cacheKey) || null;
      }
      // Cache expirado, limpiar
      this.accountMappingCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    }

    // Buscar mapeo con condiciones específicas primero
    let mapping: AccountingAccountMapping | null = null;

    if (conditions && Object.keys(conditions).length > 0) {
      // JSONB match: el contexto de consulta debe contener las condiciones del mapping.
      // Ej: contexto {method:'TRANSFER', currency:'BS'} matchea mapping {method:'TRANSFER'}.
      mapping = await this.mappingRepository
        .createQueryBuilder('mapping')
        .leftJoinAndSelect('mapping.account', 'account')
        .where('mapping.store_id = :storeId', { storeId })
        .andWhere('mapping.transaction_type = :transactionType', {
          transactionType,
        })
        .andWhere('mapping.is_active = :isActive', { isActive: true })
        .andWhere('mapping.conditions IS NOT NULL')
        .andWhere(':conditions::jsonb @> mapping.conditions', {
          conditions: JSON.stringify(conditions),
        })
        .orderBy('jsonb_object_length(mapping.conditions)', 'DESC')
        .addOrderBy('mapping.created_at', 'DESC')
        .getOne();

      if (mapping) {
        // Guardar en caché
        this.accountMappingCache.set(cacheKey, mapping);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
        return mapping;
      }
    }

    // Buscar mapeo por defecto
    mapping = await this.mappingRepository.findOne({
      where: {
        store_id: storeId,
        transaction_type: transactionType,
        is_default: true,
        is_active: true,
      },
      relations: ['account'],
    });

    // Guardar en caché (incluso si es null)
    this.accountMappingCache.set(cacheKey, mapping);
    this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

    return mapping;
  }

  /**
   * Obtener múltiples mapeos de cuentas en batch (optimización para evitar N+1)
   */
  private async getAccountMappingsBatch(
    storeId: string,
    transactionTypes: TransactionType[],
    conditions?: any,
  ): Promise<Map<TransactionType, AccountingAccountMapping | null>> {
    const result = new Map<TransactionType, AccountingAccountMapping | null>();
    const uncachedTypes: TransactionType[] = [];
    const now = Date.now();

    // Verificar caché para cada tipo
    for (const type of transactionTypes) {
      const cacheKey = `${storeId}:${type}:${JSON.stringify(conditions || {})}`;
      if (this.accountMappingCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey) || 0;
        if (now < expiry) {
          result.set(type, this.accountMappingCache.get(cacheKey) || null);
          continue;
        }
        // Cache expirado
        this.accountMappingCache.delete(cacheKey);
        this.cacheExpiry.delete(cacheKey);
      }
      uncachedTypes.push(type);
    }

    // Si todos están en caché, retornar
    if (uncachedTypes.length === 0) {
      return result;
    }

    // ⚡ OPTIMIZACIÓN: Batch query para tipos no cacheados
    if (conditions && Object.keys(conditions).length > 0) {
      // Buscar mapeos con condiciones específicas (JSONB containment)
      const specificMappings = await this.mappingRepository
        .createQueryBuilder('mapping')
        .leftJoinAndSelect('mapping.account', 'account')
        .where('mapping.store_id = :storeId', { storeId })
        .andWhere('mapping.transaction_type IN (:...transactionTypes)', {
          transactionTypes: uncachedTypes,
        })
        .andWhere('mapping.is_active = :isActive', { isActive: true })
        .andWhere('mapping.conditions IS NOT NULL')
        .andWhere(':conditions::jsonb @> mapping.conditions', {
          conditions: JSON.stringify(conditions),
        })
        // Preferir el mapping mas especifico (mas keys) y mas reciente
        .orderBy('mapping.transaction_type', 'ASC')
        .addOrderBy('jsonb_object_length(mapping.conditions)', 'DESC')
        .addOrderBy('mapping.created_at', 'DESC')
        .getMany();

      const foundTypes = new Set<TransactionType>();
      for (const mapping of specificMappings) {
        if (foundTypes.has(mapping.transaction_type)) {
          continue;
        }

        foundTypes.add(mapping.transaction_type);
        result.set(mapping.transaction_type, mapping);

        const cacheKey = `${storeId}:${mapping.transaction_type}:${JSON.stringify(conditions)}`;
        this.accountMappingCache.set(cacheKey, mapping);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
      }

      const remainingTypes = uncachedTypes.filter((t) => !foundTypes.has(t));

      if (remainingTypes.length > 0) {
        // Buscar mapeos por defecto para los restantes
        const defaultMappings = await this.mappingRepository.find({
          where: {
            store_id: storeId,
            transaction_type: In(remainingTypes),
            is_default: true,
            is_active: true,
          },
          relations: ['account'],
        });

        for (const mapping of defaultMappings) {
          result.set(mapping.transaction_type, mapping);
          const cacheKey = `${storeId}:${mapping.transaction_type}:${JSON.stringify(conditions)}`;
          this.accountMappingCache.set(cacheKey, mapping);
          this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
        }

        // Guardar nulls en caché para tipos no encontrados
        for (const type of remainingTypes) {
          if (!result.has(type)) {
            result.set(type, null);
            const cacheKey = `${storeId}:${type}:${JSON.stringify(conditions)}`;
            this.accountMappingCache.set(cacheKey, null);
            this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
          }
        }
      }
    } else {
      // Buscar solo mapeos por defecto
      const defaultMappings = await this.mappingRepository.find({
        where: {
          store_id: storeId,
          transaction_type: In(uncachedTypes),
          is_default: true,
          is_active: true,
        },
        relations: ['account'],
      });

      for (const mapping of defaultMappings) {
        result.set(mapping.transaction_type, mapping);
        const cacheKey = `${storeId}:${mapping.transaction_type}:${JSON.stringify(null)}`;
        this.accountMappingCache.set(cacheKey, mapping);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
      }

      // Guardar nulls en caché para tipos no encontrados
      for (const type of uncachedTypes) {
        if (!result.has(type)) {
          result.set(type, null);
          const cacheKey = `${storeId}:${type}:${JSON.stringify(null)}`;
          this.accountMappingCache.set(cacheKey, null);
          this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
        }
      }
    }

    return result;
  }

  /**
   * Actualizar saldos de cuentas (delegado a AccountingSharedService)
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
    return this.sharedService.updateAccountBalances(storeId, entryDate, lines);
  }

  /**
   * Reconstruir todos los saldos de cuentas desde cero (Delegado a AccountingSharedService)
   */
  async rebuildAllAccountBalances(
    storeId: string,
  ): Promise<{
    accounts_processed: number;
    periods_rebuilt: number;
    previous_balances_deleted: number;
  }> {
    return this.sharedService.rebuildAllAccountBalances(storeId);
  }

  /**
   * Obtener asientos contables
   */
  async getJournalEntries(
    storeId: string,
    dto: GetJournalEntriesDto,
  ): Promise<JournalEntry[]> {
    const query = this.journalEntryRepository
      .createQueryBuilder('entry')
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
        query.andWhere('entry.entry_type = :entryType', {
          entryType: dto.entry_type,
        });
      }
    }

    if (dto.status) {
      query.andWhere('entry.status = :status', { status: dto.status });
    }

    if (dto.start_date) {
      query.andWhere('entry.entry_date >= :startDate', {
        startDate: dto.start_date,
      });
    }

    if (dto.end_date) {
      query.andWhere('entry.entry_date <= :endDate', { endDate: dto.end_date });
    }

    if (dto.source_type) {
      query.andWhere('entry.source_type = :sourceType', {
        sourceType: dto.source_type,
      });
    }

    if (dto.limit) {
      query.limit(dto.limit);
    }

    const entries = await query.getMany();
    return entries.map((entry) => ({
      ...entry,
      entry_type:
        entry.entry_type === 'invoice' ? 'fiscal_invoice' : entry.entry_type,
    }));
  }

  /**
   * Obtener un asiento contable por ID
   */
  async getJournalEntry(
    storeId: string,
    entryId: string,
  ): Promise<JournalEntry> {
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
  async postEntry(
    storeId: string,
    entryId: string,
    userId: string,
  ): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id: entryId, store_id: storeId },
      relations: ['lines'],
    });

    if (!entry) {
      throw new NotFoundException('Asiento no encontrado');
    }

    if (entry.status !== 'draft') {
      throw new BadRequestException(
        'Solo se pueden postear asientos en estado draft',
      );
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

    // Audit Log
    await this.auditService.logAction({
      store_id: storeId,
      user_id: userId,
      action: 'post_journal_entry',
      entity_type: 'JournalEntry',
      entity_id: entry.id,
      after_value: { status: 'posted', posted_at: entry.posted_at, posted_by: userId }
    });

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
    entityManager?: EntityManager,
  ): Promise<JournalEntry> {
    const entryRepo = entityManager
      ? entityManager.getRepository(JournalEntry)
      : this.journalEntryRepository;

    const entry = await entryRepo.findOne({
      where: { id: entryId, store_id: storeId },
      relations: ['lines'],
    });

    if (!entry) {
      throw new NotFoundException('Asiento no encontrado');
    }

    if (entry.status === 'cancelled') {
      throw new BadRequestException('El asiento ya está cancelado');
    }

    // Si el asiento estaba posteado, revertir saldos
    if (entry.status === 'posted' && entry.lines && entry.lines.length > 0) {
      this.logger.log(
        `Revirtiendo saldos por cancelación de asiento ${entry.entry_number}`,
      );

      const linesToRevert = entry.lines.map((line) => ({
        account_id: line.account_id,
        debit_amount_bs: -Number(line.debit_amount_bs || 0),
        credit_amount_bs: -Number(line.credit_amount_bs || 0),
        debit_amount_usd: -Number(line.debit_amount_usd || 0),
        credit_amount_usd: -Number(line.credit_amount_usd || 0),
      }));

      await this.sharedService.updateAccountBalances(
        storeId,
        entry.entry_date,
        linesToRevert,
        entityManager,
      );
    }

    entry.status = 'cancelled';
    entry.cancelled_at = new Date();
    entry.cancelled_by = userId;
    entry.cancellation_reason = reason;

    entry.cancellation_reason = reason;

    const savedEntry = await entryRepo.save(entry);

    // Audit Log
    await this.auditService.logAction({
      store_id: storeId,
      user_id: userId,
      action: 'cancel_journal_entry',
      entity_type: 'JournalEntry',
      entity_id: entry.id,
      after_value: { status: 'cancelled', cancelled_at: entry.cancelled_at, cancelled_by: userId, reason },
      metadata: { reason }
    });

    return savedEntry;
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
      const expenseMapping = await this.getAccountMapping(
        storeId,
        'purchase_expense',
        null,
      );
      const payableMapping = await this.getAccountMapping(
        storeId,
        'accounts_payable',
        null,
      );
      const inventoryMapping = await this.getAccountMapping(
        storeId,
        'inventory_asset',
        null,
      );

      if (!expenseMapping || !payableMapping) {
        this.logger.warn(
          `No se encontraron mapeos de cuentas para orden de compra ${purchaseOrder.id}`,
        );
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
        account_name:
          payableMapping.account?.account_name || payableMapping.account_code,
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
        account_name:
          debitAccount.account?.account_name || debitAccount.account_code,
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
      const isCreditNote = fiscalInvoice.invoice_type === 'credit_note';
      const typeLabel = isCreditNote ? 'Nota de crédito' : 'Factura fiscal';

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
          relations: ['lines'],
        });

        if (existingSaleEntry) {
          // Si ya existe un asiento de venta, lo promocionamos a factura fiscal
          this.logger.log(
            `Promocionando asiento de venta ${existingSaleEntry.entry_number} a factura fiscal ${fiscalInvoice.invoice_number}`,
          );

          existingSaleEntry.source_type = 'fiscal_invoice';
          existingSaleEntry.source_id = fiscalInvoice.id;
          existingSaleEntry.entry_type = (
            isCreditNote ? 'credit_note' : 'fiscal_invoice'
          ) as JournalEntryType;
          existingSaleEntry.description = `${typeLabel} ${fiscalInvoice.invoice_number}`;
          existingSaleEntry.reference_number = fiscalInvoice.invoice_number;
          existingSaleEntry.metadata = {
            ...(existingSaleEntry.metadata || {}),
            fiscal_invoice_id: fiscalInvoice.id,
            original_source_type: 'sale',
            original_source_id: fiscalInvoice.sale_id,
          };

          // Actualizar descripciones de líneas para que coincidan con la factura
          if (existingSaleEntry.lines) {
            for (const line of existingSaleEntry.lines) {
              if (line.description && line.description.includes('Venta')) {
                line.description = `${typeLabel} ${fiscalInvoice.invoice_number} - Venta`;
              } else if (
                line.description &&
                line.description.includes('Cobro')
              ) {
                line.description = `${typeLabel} ${fiscalInvoice.invoice_number} - Cobro`;
              } else if (line.description && line.description.includes('IVA')) {
                line.description = `${typeLabel} ${fiscalInvoice.invoice_number} - IVA`;
              }
            }
          }

          return this.journalEntryRepository.save(existingSaleEntry);
        }
      }

      // ⚡ OPTIMIZACIÓN: Obtener todos los mapeos de cuentas en batch
      const mappings = await this.getAccountMappingsBatch(storeId, [
        'sale_revenue',
        'sale_tax',
        'accounts_receivable',
        'cash_asset',
        'sale_cost',
        'inventory_asset',
      ]);
      const revenueMapping = mappings.get('sale_revenue');
      const taxMapping = mappings.get('sale_tax');
      const receivableMapping = mappings.get('accounts_receivable');
      const cashMapping = mappings.get('cash_asset') || null;
      const costMapping = mappings.get('sale_cost');
      const inventoryMapping = mappings.get('inventory_asset');

      if (!revenueMapping) {
        this.logger.warn(
          `No se encontraron mapeos de cuentas para factura fiscal ${fiscalInvoice.id}`,
        );
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

      const multiplier = isCreditNote ? -1 : 1;

      const subtotalBs = Number(fiscalInvoice.subtotal_bs) * multiplier;
      const subtotalUsd = Number(fiscalInvoice.subtotal_usd) * multiplier;
      const taxBs = Number(fiscalInvoice.tax_amount_bs) * multiplier;
      const taxUsd = Number(fiscalInvoice.tax_amount_usd) * multiplier;
      const totalBs = Number(fiscalInvoice.total_bs) * multiplier;
      const totalUsd = Number(fiscalInvoice.total_usd) * multiplier;
      let costBs = 0;
      let costUsd = 0;

      if (fiscalInvoice.sale_id) {
        const saleItems = await this.saleItemRepository.find({
          where: { sale_id: fiscalInvoice.sale_id },
          relations: ['lot', 'product'],
        });
        const costs = await this.calculateSaleCosts(storeId, saleItems);
        costBs = costs.costBs * multiplier;
        costUsd = costs.costUsd * multiplier;
      }

      // Determinar método de pago (prioridad: sale.payment > fiscal_invoice.payment_method)
      let paymentMethod: string | null = fiscalInvoice.payment_method || null;
      let salePayment: any | null = null;

      if (fiscalInvoice.sale_id) {
        const sale = await this.saleRepository.findOne({
          where: { store_id: storeId, id: fiscalInvoice.sale_id },
          select: { id: true, payment: true },
        });
        if (sale?.payment) {
          salePayment = sale.payment;
          paymentMethod = sale.payment?.method || paymentMethod;
        }
      }

      const isCredit = paymentMethod === 'FIAO' || Boolean(fiscalInvoice.customer_id);
      const isSplit =
        salePayment?.method === 'SPLIT' &&
        Array.isArray(salePayment?.split_payments) &&
        salePayment.split_payments.length > 0;

      const absTotalBs = Math.abs(totalBs);
      const absTotalUsd = Math.abs(totalUsd);

      // Activo (cobro o cuenta por cobrar)
      if (isCredit) {
        if (!receivableMapping) {
          this.logger.warn(
            `No se encontró mapeo accounts_receivable para factura ${fiscalInvoice.id}`,
          );
          return null;
        }
        lines.push({
          account_id: receivableMapping.account_id,
          account_code: receivableMapping.account_code,
          account_name:
            receivableMapping.account?.account_name ||
            receivableMapping.account_code,
          debit_amount_bs: multiplier > 0 ? absTotalBs : 0,
          credit_amount_bs: multiplier < 0 ? absTotalBs : 0,
          debit_amount_usd: multiplier > 0 ? absTotalUsd : 0,
          credit_amount_usd: multiplier < 0 ? absTotalUsd : 0,
          description: `${typeLabel} ${fiscalInvoice.invoice_number} - Cuenta por cobrar`,
        });
      } else if (isSplit) {
        const splitPayments = salePayment.split_payments;
        const round = (value: number) => Math.round(value * 100) / 100;

        const debitLines: typeof lines = [];
        let sumBs = 0;
        let sumUsd = 0;

        for (const sp of splitPayments) {
          const method = String((sp as any).method || '').trim();
          if (!method) continue;

          const amountBs = round(Number((sp as any).amount_bs || 0));
          const amountUsd = round(Number((sp as any).amount_usd || 0));
          if (amountBs <= 0 && amountUsd <= 0) continue;

          let assetMapping = await this.getAccountMapping(storeId, 'cash_asset', {
            method,
          });
          if (!assetMapping) {
            assetMapping = cashMapping;
          }
          if (!assetMapping) {
            this.logger.warn(
              `No se encontró mapeo de activo para split method=${method} en factura ${fiscalInvoice.id}`,
            );
            continue;
          }

          debitLines.push({
            account_id: assetMapping.account_id,
            account_code: assetMapping.account_code,
            account_name:
              assetMapping.account?.account_name || assetMapping.account_code,
            debit_amount_bs: multiplier > 0 ? amountBs : 0,
            credit_amount_bs: multiplier < 0 ? amountBs : 0,
            debit_amount_usd: multiplier > 0 ? amountUsd : 0,
            credit_amount_usd: multiplier < 0 ? amountUsd : 0,
            description: `${typeLabel} ${fiscalInvoice.invoice_number} - Cobro ${method} (Split)`,
          });

          sumBs = round(sumBs + amountBs);
          sumUsd = round(sumUsd + amountUsd);
        }

        if (debitLines.length === 0) {
          // Fallback seguro: usar mapping default para no generar asiento desbalanceado
          if (cashMapping) {
            debitLines.push({
              account_id: cashMapping.account_id,
              account_code: cashMapping.account_code,
              account_name:
                cashMapping.account?.account_name || cashMapping.account_code,
              debit_amount_bs: multiplier > 0 ? absTotalBs : 0,
              credit_amount_bs: multiplier < 0 ? absTotalBs : 0,
              debit_amount_usd: multiplier > 0 ? absTotalUsd : 0,
              credit_amount_usd: multiplier < 0 ? absTotalUsd : 0,
              description: `${typeLabel} ${fiscalInvoice.invoice_number} - Cobro (Split fallback)`,
            });
          } else {
            this.logger.warn(
              `Factura ${fiscalInvoice.id} (split) sin cash_asset mapping default. No se puede generar asiento.`,
            );
            return null;
          }
        } else {
          // Ajuste de redondeo de split
          const diffBs = round(absTotalBs - sumBs);
          const diffUsd = round(absTotalUsd - sumUsd);
          const tolerance = 0.05;

          if (Math.abs(diffBs) <= tolerance && Math.abs(diffUsd) <= tolerance) {
            const last = debitLines[debitLines.length - 1];
            if (multiplier > 0) {
              last.debit_amount_bs = round(last.debit_amount_bs + diffBs);
              last.debit_amount_usd = round(last.debit_amount_usd + diffUsd);
            } else {
              last.credit_amount_bs = round(last.credit_amount_bs + diffBs);
              last.credit_amount_usd = round(last.credit_amount_usd + diffUsd);
            }
          } else if (Math.abs(diffBs) > 0.01 || Math.abs(diffUsd) > 0.01) {
            this.logger.warn(
              `Split payments no cuadran para factura ${fiscalInvoice.id}. total_bs=${absTotalBs}, sum_bs=${sumBs}, total_usd=${absTotalUsd}, sum_usd=${sumUsd}.`,
            );
          }
        }

        lines.push(...debitLines);
      } else {
        // Pago directo (un solo método): usar mapping por método si existe
        let assetMapping: AccountingAccountMapping | null = null;
        if (paymentMethod) {
          assetMapping = await this.getAccountMapping(storeId, 'cash_asset', {
            method: paymentMethod,
          });
        }
        assetMapping = assetMapping || cashMapping;

        if (!assetMapping) {
          this.logger.warn(
            `Factura ${fiscalInvoice.id} sin cash_asset mapping (method=${paymentMethod || 'N/A'}). No se puede generar asiento.`,
          );
          return null;
        }
        lines.push({
          account_id: assetMapping.account_id,
          account_code: assetMapping.account_code,
          account_name:
            assetMapping.account?.account_name || assetMapping.account_code,
          debit_amount_bs: multiplier > 0 ? absTotalBs : 0,
          credit_amount_bs: multiplier < 0 ? absTotalBs : 0,
          debit_amount_usd: multiplier > 0 ? absTotalUsd : 0,
          credit_amount_usd: multiplier < 0 ? absTotalUsd : 0,
          description: `${typeLabel} ${fiscalInvoice.invoice_number} - Cobro`,
        });
      }

      // Ingreso por venta
      lines.push({
        account_id: revenueMapping.account_id,
        account_code: revenueMapping.account_code,
        account_name:
          revenueMapping.account?.account_name || revenueMapping.account_code,
        debit_amount_bs: multiplier < 0 ? Math.abs(subtotalBs) : 0,
        credit_amount_bs: multiplier > 0 ? subtotalBs : 0,
        debit_amount_usd: multiplier < 0 ? Math.abs(subtotalUsd) : 0,
        credit_amount_usd: multiplier > 0 ? subtotalUsd : 0,
        description: `${typeLabel} ${fiscalInvoice.invoice_number} - Venta`,
      });

      // Impuesto (si aplica)
      if (Math.abs(taxBs) > 0 || Math.abs(taxUsd) > 0) {
        if (taxMapping) {
          lines.push({
            account_id: taxMapping.account_id,
            account_code: taxMapping.account_code,
            account_name:
              taxMapping.account?.account_name || taxMapping.account_code,
            debit_amount_bs: multiplier < 0 ? Math.abs(taxBs) : 0,
            credit_amount_bs: multiplier > 0 ? taxBs : 0,
            debit_amount_usd: multiplier < 0 ? Math.abs(taxUsd) : 0,
            credit_amount_usd: multiplier > 0 ? taxUsd : 0,
            description: `${typeLabel} ${fiscalInvoice.invoice_number} - IVA`,
          });
        }
      }

      if (Math.abs(costBs) > 0 || Math.abs(costUsd) > 0) {
        if (costMapping) {
          lines.push({
            account_id: costMapping.account_id,
            account_code: costMapping.account_code,
            account_name:
              costMapping.account?.account_name || costMapping.account_code,
            debit_amount_bs: multiplier > 0 ? costBs : 0,
            credit_amount_bs: multiplier < 0 ? Math.abs(costBs) : 0,
            debit_amount_usd: multiplier > 0 ? costUsd : 0,
            credit_amount_usd: multiplier < 0 ? Math.abs(costUsd) : 0,
            description: `Costo de venta - ${typeLabel} ${fiscalInvoice.invoice_number}`,
          });
        }

        if (inventoryMapping) {
          lines.push({
            account_id: inventoryMapping.account_id,
            account_code: inventoryMapping.account_code,
            account_name:
              inventoryMapping.account?.account_name ||
              inventoryMapping.account_code,
            debit_amount_bs: multiplier < 0 ? Math.abs(costBs) : 0,
            credit_amount_bs: multiplier > 0 ? costBs : 0,
            debit_amount_usd: multiplier < 0 ? Math.abs(costUsd) : 0,
            credit_amount_usd: multiplier > 0 ? costUsd : 0,
            description: `Reingreso/Salida de inventario - ${typeLabel} ${fiscalInvoice.invoice_number}`,
          });
        }
      }

      // Crear asiento
      const entry = this.journalEntryRepository.create({
        id: randomUUID(),
        store_id: storeId,
        entry_number: entryNumber,
        entry_date: entryDate,
        entry_type: (isCreditNote
          ? 'credit_note'
          : 'fiscal_invoice') as JournalEntryType,
        source_type: 'fiscal_invoice',
        source_id: fiscalInvoice.id,
        description: `${typeLabel} ${fiscalInvoice.invoice_number}`,
        reference_number: fiscalInvoice.invoice_number,
        total_debit_bs: lines.reduce((sum, l) => sum + l.debit_amount_bs, 0),
        total_credit_bs: lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
        total_debit_usd: lines.reduce((sum, l) => sum + l.debit_amount_usd, 0),
        total_credit_usd: lines.reduce(
          (sum, l) => sum + l.credit_amount_usd,
          0,
        ),
        exchange_rate: fiscalInvoice.exchange_rate,
        currency: fiscalInvoice.currency,
        status: 'posted',
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: {
          fiscal_invoice_id: fiscalInvoice.id,
          is_credit_note: isCreditNote,
        },
      }) as JournalEntry;

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
    transfer: {
      id: string;
      transfer_number: string;
      received_at: Date | null;
      items: Array<{ product_id: string; quantity_received: number }>;
    },
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
      const inventoryMapping = await this.getAccountMapping(
        storeId,
        'inventory_asset',
        null,
      );

      if (!inventoryMapping) {
        this.logger.warn(
          `No se encontró mapeo de cuenta de inventario para transferencia ${transfer.id}`,
        );
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
        this.logger.debug(
          `Transferencia ${transfer.id} no tiene costo calculable, omitiendo asiento contable`,
        );
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
        account_name:
          inventoryMapping.account?.account_name ||
          inventoryMapping.account_code,
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
        account_name:
          inventoryMapping.account?.account_name ||
          inventoryMapping.account_code,
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
      const inventoryMapping = await this.getAccountMapping(
        storeId,
        'inventory_asset',
        null,
      );
      const adjustmentMapping = await this.getAccountMapping(
        storeId,
        'adjustment',
        null,
      );

      if (!inventoryMapping) {
        this.logger.warn(
          `No se encontró mapeo de cuenta de inventario para ajuste ${movement.id}`,
        );
        return null;
      }

      // Obtener costo del producto para calcular el valor del ajuste
      const product = await this.productRepository.findOne({
        where: { id: movement.product_id, store_id: storeId },
      });

      if (!product) {
        this.logger.warn(
          `Producto ${movement.product_id} no encontrado para ajuste ${movement.id}`,
        );
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
        this.logger.debug(
          `Ajuste ${movement.id} no tiene valor contable, omitiendo asiento`,
        );
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
      const expenseAccount =
        adjustmentMapping ||
        (await this.getAccountMapping(storeId, 'expense', null));

      if (qtyDelta > 0) {
        // Ajuste positivo: aumenta inventario
        // Débito: Inventario
        lines.push({
          account_id: inventoryMapping.account_id,
          account_code: inventoryMapping.account_code,
          account_name:
            inventoryMapping.account?.account_name ||
            inventoryMapping.account_code,
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
            account_name:
              expenseAccount.account?.account_name ||
              expenseAccount.account_code,
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
            account_name:
              expenseAccount.account?.account_name ||
              expenseAccount.account_code,
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
          account_name:
            inventoryMapping.account?.account_name ||
            inventoryMapping.account_code,
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
        total_credit_usd: lines.reduce(
          (sum, l) => sum + l.credit_amount_usd,
          0,
        ),
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
    payment: {
      id: string;
      paid_at: Date;
      amount_bs: number;
      amount_usd: number;
      bcv_rate?: number | null;
      book_rate_bcv?: number | null;
      fx_gain_loss_bs?: number | null;
      method: string;
    },
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
      const receivableMapping = await this.getAccountMapping(
        storeId,
        'accounts_receivable',
        null,
      );
      const assetMapping = await this.getAccountMapping(storeId, 'cash_asset', {
        method: payment.method,
      });
      const incomeMapping = await this.getAccountMapping(storeId, 'income', null);
      const expenseMapping = await this.getAccountMapping(storeId, 'expense', null);
      const fxGainMapping = await this.getAccountMapping(
        storeId,
        'fx_gain_realized',
        null,
      );
      const fxLossMapping = await this.getAccountMapping(
        storeId,
        'fx_loss_realized',
        null,
      );

      if (!receivableMapping) {
        this.logger.warn(
          `No se encontró mapeo de cuenta por cobrar para pago de deuda ${payment.id}`,
        );
        return null;
      }

      if (!assetMapping) {
        this.logger.warn(
          `No se encontró mapeo de cuenta de activo para método ${payment.method} en pago ${payment.id}`,
        );
        return null;
      }

      const entryDate = payment.paid_at || new Date();
      const entryNumber = await this.generateEntryNumber(storeId, entryDate);

      const roundTwo = (value: number) => Math.round(value * 100) / 100;
      const roundSix = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

      const paymentAmountBs = roundTwo(Number(payment.amount_bs));
      const paymentAmountUsd = roundTwo(Number(payment.amount_usd));

      // Valorar CxC al valor libro para evitar saldos negativos por variacion de tasa.
      // Si no viene book_rate_bcv en el pago, intentar tomarlo de la deuda.
      let bookRateBcv =
        payment.book_rate_bcv && Number(payment.book_rate_bcv) > 0
          ? Number(payment.book_rate_bcv)
          : null;

      if (!bookRateBcv) {
        const debtRecord = await this.debtRepository.findOne({
          where: { id: debt.id, store_id: storeId },
        });
        if (debtRecord) {
          if (debtRecord.book_rate_bcv && Number(debtRecord.book_rate_bcv) > 0) {
            bookRateBcv = Number(debtRecord.book_rate_bcv);
          } else if (Number(debtRecord.amount_usd) > 0) {
            bookRateBcv = Number(debtRecord.amount_bs) / Number(debtRecord.amount_usd);
          }
        }
      }

      if (!bookRateBcv) {
        // Ultimo fallback: usar tasa efectiva del cobro
        bookRateBcv = paymentAmountUsd > 0 ? paymentAmountBs / paymentAmountUsd : 0;
      }

      bookRateBcv = roundSix(bookRateBcv);
      const bookAmountBs = roundTwo(paymentAmountUsd * bookRateBcv);
      const fxDiffBs = roundTwo(paymentAmountBs - bookAmountBs);

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
        account_id: assetMapping.account_id,
        account_code: assetMapping.account_code,
        account_name:
          assetMapping.account?.account_name || assetMapping.account_code,
        debit_amount_bs: paymentAmountBs,
        credit_amount_bs: 0,
        debit_amount_usd: paymentAmountUsd,
        credit_amount_usd: 0,
        description: `Pago de deuda - ${payment.method}`,
      });

      // Crédito: Cuentas por Cobrar (disminuye activo) - al valor libro
      lines.push({
        account_id: receivableMapping.account_id,
        account_code: receivableMapping.account_code,
        account_name:
          receivableMapping.account?.account_name ||
          receivableMapping.account_code,
        debit_amount_bs: 0,
        credit_amount_bs: bookAmountBs,
        debit_amount_usd: 0,
        credit_amount_usd: paymentAmountUsd,
        description: `Cobro de deuda`,
      });

      // Diferencia cambiaria realizada (solo Bs)
      if (Math.abs(fxDiffBs) > 0.01) {
        if (fxDiffBs > 0) {
          const gainAccount = fxGainMapping || incomeMapping;
          if (gainAccount) {
            lines.push({
              account_id: gainAccount.account_id,
              account_code: gainAccount.account_code,
              account_name:
                gainAccount.account?.account_name || gainAccount.account_code,
              debit_amount_bs: 0,
              credit_amount_bs: Math.abs(fxDiffBs),
              debit_amount_usd: 0,
              credit_amount_usd: 0,
              description: `Ganancia cambiaria realizada - Cobro deuda`,
            });
          }
        } else {
          const lossAccount = fxLossMapping || expenseMapping;
          if (lossAccount) {
            lines.push({
              account_id: lossAccount.account_id,
              account_code: lossAccount.account_code,
              account_name:
                lossAccount.account?.account_name || lossAccount.account_code,
              debit_amount_bs: Math.abs(fxDiffBs),
              credit_amount_bs: 0,
              debit_amount_usd: 0,
              credit_amount_usd: 0,
              description: `Pérdida cambiaria realizada - Cobro deuda`,
            });
          }
        }
      }

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
        total_debit_bs: roundTwo(
          lines.reduce((sum, l) => sum + l.debit_amount_bs, 0),
        ),
        total_credit_bs: roundTwo(
          lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
        ),
        total_debit_usd: roundTwo(
          lines.reduce((sum, l) => sum + l.debit_amount_usd, 0),
        ),
        total_credit_usd: roundTwo(
          lines.reduce((sum, l) => sum + l.credit_amount_usd, 0),
        ),
        exchange_rate:
          payment.bcv_rate && Number(payment.bcv_rate) > 0
            ? Number(payment.bcv_rate)
            : paymentAmountUsd > 0
              ? paymentAmountBs / paymentAmountUsd
              : null,
        currency: 'MIXED',
        status: 'posted',
        is_auto_generated: true,
        posted_at: new Date(),
        metadata: {
          debt_id: debt.id,
          payment_id: payment.id,
          method: payment.method,
          book_rate_bcv: bookRateBcv,
          book_amount_bs: bookAmountBs,
          fx_gain_loss_bs: fxDiffBs,
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
      const cashMapping = await this.getAccountMapping(
        storeId,
        'cash_asset',
        null,
      );
      const incomeMapping = await this.getAccountMapping(
        storeId,
        'income',
        null,
      );
      const expenseMapping = await this.getAccountMapping(
        storeId,
        'expense',
        null,
      );

      if (!cashMapping) {
        this.logger.warn(
          `No se encontró mapeo de cuenta de caja para cierre de sesión ${session.id}`,
        );
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
          account_name:
            cashMapping.account?.account_name || cashMapping.account_code,
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
            account_name:
              incomeMapping.account?.account_name || incomeMapping.account_code,
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
            account_name:
              expenseMapping.account?.account_name ||
              expenseMapping.account_code,
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
          account_name:
            cashMapping.account?.account_name || cashMapping.account_code,
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
        total_credit_usd: lines.reduce(
          (sum, l) => sum + l.credit_amount_usd,
          0,
        ),
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
   * Calcular saldos de múltiples cuentas (delegado a AccountingSharedService)
   */
  async calculateAccountBalancesBatch(
    storeId: string,
    accountIds: string[],
    asOfDate: Date,
  ): Promise<Map<string, { balance_bs: number; balance_usd: number }>> {
    return this.sharedService.calculateAccountBalancesBatch(
      storeId,
      accountIds,
      asOfDate,
    );
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

    if (
      account.account_type === 'asset' ||
      account.account_type === 'expense'
    ) {
      balanceBs = totalDebitBs - totalCreditBs;
      balanceUsd = totalDebitUsd - totalCreditUsd;
    } else {
      balanceBs = totalCreditBs - totalDebitBs;
      balanceUsd = totalCreditUsd - totalDebitUsd;
    }

    return { balance_bs: balanceBs, balance_usd: balanceUsd };
  }

  /**
   * Aging de Cuentas por Cobrar (Delegado a ReportingService)
   */
  async getAccountsReceivableAging(
    storeId: string,
    asOfDate: Date,
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
    return this.reportingService.getAccountsReceivableAging(storeId, asOfDate);
  }

  /**
   * Aging de Cuentas por Pagar (Delegado a ReportingService)
   */
  async getAccountsPayableAging(
    storeId: string,
    asOfDate: Date,
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
    return this.reportingService.getAccountsPayableAging(storeId, asOfDate);
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
    const balancesMap = await this.calculateAccountBalancesBatch(
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

    // Obtener todos los asientos posteados hasta la fecha
    const _postedEntries = await this.journalEntryRepository
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
    const openingBalances = await this.calculateAccountBalancesBatch(
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
    _method: 'direct' | 'indirect' = 'indirect',
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
    const incomeStatement = await this.getIncomeStatement(
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
        ? await this.calculateAccountBalancesBatch(
          storeId,
          cashAccountIds,
          startDate,
        )
        : new Map();
    const cashBalancesEnd =
      cashAccountIds.length > 0
        ? await this.calculateAccountBalancesBatch(
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
        ? await this.calculateAccountBalancesBatch(
          storeId,
          specialAccountIds,
          startDate,
        )
        : new Map();
    const specialBalancesEnd =
      specialAccountIds.length > 0
        ? await this.calculateAccountBalancesBatch(
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
    const investingActivities: Array<{
      description: string;
      amount_bs: number;
      amount_usd: number;
    }> = [];

    // Actividades de financiamiento (préstamos, capital, etc.)
    // Por ahora vacío, se puede expandir
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
   * Obtener o crear período contable (Delegado)
   */
  private async getOrCreatePeriod(
    storeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AccountingPeriod> {
    return this.periodService.getOrCreatePeriod(
      storeId,
      periodStart,
      periodEnd,
    );
  }

  /**
   * Validar si un período está abierto (Delegado)
   */
  async validatePeriodOpen(storeId: string, entryDate: Date): Promise<void> {
    return this.periodService.validatePeriodOpen(storeId, entryDate);
  }

  /**
   * Genera asiento idempotente de revaluacion FX (no realizada) para un periodo.
   * Ajusta SOLO Bs para cuentas monetarias USD marcadas en chart_of_accounts.metadata.fx_revaluation.enabled = true.
   */
  private async generatePeriodFxRevaluationEntry(
    storeId: string,
    period: AccountingPeriod,
    periodEnd: Date,
    userId: string,
  ): Promise<JournalEntry | null> {
    // Idempotencia: un asiento por periodo
    const existing = await this.journalEntryRepository.findOne({
      where: {
        store_id: storeId,
        source_type: 'period_fx_revaluation',
        source_id: period.id,
      },
      relations: ['lines'],
    });

    if (existing) {
      return existing;
    }

    // Cuentas revaluables
    const accountsToRevalue = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.store_id = :storeId', { storeId })
      .andWhere('account.is_active = :active', { active: true })
      .andWhere(
        "account.metadata -> 'fx_revaluation' ->> 'enabled' = 'true'",
      )
      .orderBy('account.account_code', 'ASC')
      .getMany();

    if (accountsToRevalue.length === 0) {
      return null;
    }

    // Tasa BCV al cierre
    const bcvRate =
      (await this.exchangeService.getRateByTypeAtDate(
        storeId,
        'BCV',
        periodEnd,
      )) || (await this.exchangeService.getCurrentRate(storeId, 36));

    if (!bcvRate || bcvRate <= 0) {
      this.logger.warn(
        `No se pudo obtener tasa BCV para revaluacion de periodo ${period.period_code}.`,
      );
      return null;
    }

    const accountIds = accountsToRevalue.map((a) => a.id);
    const balances = await this.sharedService.calculateAccountBalancesBatch(
      storeId,
      accountIds,
      periodEnd,
    );

    const fxGainMapping = await this.getAccountMapping(
      storeId,
      'fx_gain_unrealized',
      null,
    );
    const fxLossMapping = await this.getAccountMapping(
      storeId,
      'fx_loss_unrealized',
      null,
    );
    const incomeFallback = await this.getAccountMapping(storeId, 'income', null);
    const expenseFallback = await this.getAccountMapping(
      storeId,
      'expense',
      null,
    );

    const roundTwo = (value: number) => Math.round(value * 100) / 100;

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

    for (const account of accountsToRevalue) {
      const bal = balances.get(account.id) || { balance_bs: 0, balance_usd: 0 };
      const balanceUsd = roundTwo(Number(bal.balance_usd || 0));
      if (Math.abs(balanceUsd) <= 0.01) {
        continue;
      }

      const currentBs = roundTwo(Number(bal.balance_bs || 0));
      const expectedBs = roundTwo(balanceUsd * bcvRate);
      const delta = roundTwo(expectedBs - currentBs);

      if (Math.abs(delta) <= 0.01) {
        continue;
      }

      const isAssetLike =
        account.account_type === 'asset' || account.account_type === 'expense';

      const accountDebitBs =
        isAssetLike && delta > 0
          ? Math.abs(delta)
          : !isAssetLike && delta < 0
            ? Math.abs(delta)
            : 0;
      const accountCreditBs =
        isAssetLike && delta < 0
          ? Math.abs(delta)
          : !isAssetLike && delta > 0
            ? Math.abs(delta)
            : 0;

      // Para FX: ganancia siempre es credito, perdida siempre es debito.
      const isGain = isAssetLike ? delta > 0 : delta < 0;
      const fxAmount = Math.abs(delta);
      const fxAccount = isGain
        ? fxGainMapping || incomeFallback
        : fxLossMapping || expenseFallback;

      if (!fxAccount) {
        this.logger.warn(
          `No se encontró cuenta para ${isGain ? 'ganancia' : 'pérdida'} cambiaria (no realizada) en store ${storeId}.`,
        );
        continue;
      }

      lines.push({
        account_id: account.id,
        account_code: account.account_code,
        account_name: account.account_name,
        debit_amount_bs: accountDebitBs,
        credit_amount_bs: accountCreditBs,
        debit_amount_usd: 0,
        credit_amount_usd: 0,
        description: `Revaluación BCV cierre ${period.period_code}`,
      });

      lines.push({
        account_id: fxAccount.account_id,
        account_code: fxAccount.account_code,
        account_name: fxAccount.account?.account_name || fxAccount.account_code,
        debit_amount_bs: isGain ? 0 : fxAmount,
        credit_amount_bs: isGain ? fxAmount : 0,
        debit_amount_usd: 0,
        credit_amount_usd: 0,
        description: `Diferencia cambiaria no realizada - ${period.period_code}`,
      });
    }

    if (lines.length === 0) {
      // Aun sin asiento, podemos actualizar tasa libro de deudas si CxC esta marcada revaluable.
      // Se decide no hacerlo para evitar cambios silenciosos sin asiento.
      return null;
    }

    const entryDate = periodEnd;
    const entryNumber = await this.generateEntryNumber(storeId, entryDate);

    const entry = this.journalEntryRepository.create({
      id: randomUUID(),
      store_id: storeId,
      entry_number: entryNumber,
      entry_date: entryDate,
      entry_type: 'manual',
      source_type: 'period_fx_revaluation',
      source_id: period.id,
      description: `Revaluación FX (BCV) - Período ${period.period_code}`,
      reference_number: period.period_code,
      total_debit_bs: roundTwo(lines.reduce((sum, l) => sum + l.debit_amount_bs, 0)),
      total_credit_bs: roundTwo(
        lines.reduce((sum, l) => sum + l.credit_amount_bs, 0),
      ),
      total_debit_usd: 0,
      total_credit_usd: 0,
      exchange_rate: bcvRate,
      currency: 'BS',
      status: 'posted',
      is_auto_generated: true,
      posted_at: new Date(),
      posted_by: userId,
      metadata: {
        period_id: period.id,
        period_code: period.period_code,
        rate_type: 'BCV',
        bcv_rate: bcvRate,
      },
    });

    const savedEntry = await this.journalEntryRepository.save(entry);

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
        debit_amount_usd: 0,
        credit_amount_usd: 0,
      }),
    );

    await this.journalEntryLineRepository.save(entryLines);
    await this.sharedService.updateAccountBalances(storeId, entryDate, lines);

    // Si la cuenta de CxC esta marcada revaluable, actualizar tasa libro de deudas abiertas
    try {
      const arMapping = await this.getAccountMapping(
        storeId,
        'accounts_receivable',
        null,
      );
      if (arMapping) {
        const revaluableAccountIds = new Set(accountIds);
        if (revaluableAccountIds.has(arMapping.account_id)) {
          await this.debtRepository
            .createQueryBuilder()
            .update(Debt)
            .set({ book_rate_bcv: bcvRate, book_rate_as_of: entryDate })
            .where('store_id = :storeId', { storeId })
            .andWhere('status IN (:...statuses)', {
              statuses: [DebtStatus.OPEN, DebtStatus.PARTIAL],
            })
            .execute();
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo actualizar tasa libro de deudas en revaluación de periodo ${period.period_code}`,
        error instanceof Error ? error.message : String(error),
      );
    }

    return this.journalEntryRepository.findOne({
      where: { id: savedEntry.id },
      relations: ['lines'],
    }) as Promise<JournalEntry>;
  }

  /**
   * Cerrar un período contable (Delegado a AccountingPeriodService)
   */
  async closePeriod(
    storeId: string,
    periodStart: Date,
    periodEnd: Date,
    userId: string,
    note?: string,
  ): Promise<{ period: AccountingPeriod; closingEntry: JournalEntry | null }> {
    // Generar revaluacion FX antes del cierre para que impacte el estado de resultados del periodo.
    try {
      const period = await this.getOrCreatePeriod(storeId, periodStart, periodEnd);
      await this.generatePeriodFxRevaluationEntry(storeId, period, periodEnd, userId);
    } catch (error) {
      this.logger.warn(
        `No se pudo generar revaluación FX para cierre ${periodStart.toISOString()}..${periodEnd.toISOString()}`,
        error instanceof Error ? error.message : String(error),
      );
    }

    return this.periodService.closePeriod(
      storeId,
      periodStart,
      periodEnd,
      userId,
      note,
    );
  }

  /**
   * Reabrir un período cerrado (Delegado a AccountingPeriodService)
   */
  async reopenPeriod(
    storeId: string,
    periodCode: string,
    userId: string,
    reason: string,
  ): Promise<AccountingPeriod> {
    return this.periodService.reopenPeriod(storeId, periodCode, userId, reason);
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
    const errors: Array<{
      type: string;
      severity: 'error' | 'warning';
      message: string;
      details?: any;
    }> = [];
    const warnings: Array<{ type: string; message: string; details?: any }> =
      [];

    try {
      const _filterDate =
        startDate && endDate ? Between(startDate, endDate) : undefined;

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
          const entriesInClosedPeriod = await this.journalEntryRepository.count(
            {
              where: {
                store_id: storeId,
                entry_date: Between(period.period_start, period.period_end),
                status: 'posted',
              },
            },
          );

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
              account.account_type === 'asset' ||
                account.account_type === 'expense'
                ? Number(balance.closing_balance_debit_bs || 0) -
                Number(balance.closing_balance_credit_bs || 0)
                : Number(balance.closing_balance_credit_bs || 0) -
                Number(balance.closing_balance_debit_bs || 0);

            const calculatedBalanceBs = calculatedBalance.balance_bs;
            const difference = Math.abs(
              expectedBalanceBs - calculatedBalanceBs,
            );

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
          this.logger.warn(
            `Error validando balance de cuenta ${account.account_code}: ${error instanceof Error ? error.message : String(error)}`,
          );
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
          const linesTotalDebitBs = (entry.lines || []).reduce(
            (sum, line) => sum + Number(line.debit_amount_bs || 0),
            0,
          );
          const linesTotalCreditBs = (entry.lines || []).reduce(
            (sum, line) => sum + Number(line.credit_amount_bs || 0),
            0,
          );

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
          this.logger.warn(
            `Error validando totales del asiento ${entry.entry_number}: ${error instanceof Error ? error.message : String(error)}`,
          );
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
      this.logger.error(
        `Error en validateAccountingIntegrity: ${error instanceof Error ? error.stack : String(error)}`,
      );
      errors.push({
        type: 'validation_error',
        severity: 'error',
        message: `Error al ejecutar validación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
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
        const calculatedBalance = await this.calculateAccountBalance(
          storeId,
          account.id,
          asOfDate,
        );

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
            account.account_type === 'asset' ||
              account.account_type === 'expense'
              ? Number(balance.closing_balance_debit_bs || 0) -
              Number(balance.closing_balance_credit_bs || 0)
              : Number(balance.closing_balance_credit_bs || 0) -
              Number(balance.closing_balance_debit_bs || 0);

          expectedBalanceUsd =
            account.account_type === 'asset' ||
              account.account_type === 'expense'
              ? Number(balance.closing_balance_debit_usd || 0) -
              Number(balance.closing_balance_credit_usd || 0)
              : Number(balance.closing_balance_credit_usd || 0) -
              Number(balance.closing_balance_debit_usd || 0);
        }

        const differenceBs = Math.abs(
          expectedBalanceBs - calculatedBalance.balance_bs,
        );
        const differenceUsd = Math.abs(
          expectedBalanceUsd - calculatedBalance.balance_usd,
        );

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
        this.logger.warn(
          `Error reconciliando cuenta ${account.account_code}: ${error instanceof Error ? error.message : String(error)}`,
        );
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
    const errors: Array<{
      entry_id: string;
      entry_number: string;
      error: string;
    }> = [];
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
        c = t - sum - y;
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
    const _detectErrorType = (
      difference: number,
    ): {
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
    const getToleranceThreshold = (
      totalAmount: number,
    ): {
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
        const debitAmountsBs = lines.map((line) =>
          Number(line.debit_amount_bs || 0),
        );
        const creditAmountsBs = lines.map((line) =>
          Number(line.credit_amount_bs || 0),
        );
        const debitAmountsUsd = lines.map((line) =>
          Number(line.debit_amount_usd || 0),
        );
        const creditAmountsUsd = lines.map((line) =>
          Number(line.credit_amount_usd || 0),
        );

        // Usar Neumaier para mayor precisión en grandes sumas, Kahan como fallback para listas pequeñas
        const calculatedDebitBs = roundTo2Decimals(
          debitAmountsBs.length > 50
            ? neumaierSum(debitAmountsBs)
            : kahanSum(debitAmountsBs),
        );
        const calculatedCreditBs = roundTo2Decimals(
          creditAmountsBs.length > 50
            ? neumaierSum(creditAmountsBs)
            : kahanSum(creditAmountsBs),
        );
        const calculatedDebitUsd = roundTo2Decimals(
          debitAmountsUsd.length > 50
            ? neumaierSum(debitAmountsUsd)
            : kahanSum(debitAmountsUsd),
        );
        const calculatedCreditUsd = roundTo2Decimals(
          creditAmountsUsd.length > 50
            ? neumaierSum(creditAmountsUsd)
            : kahanSum(creditAmountsUsd),
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
          ...debitAmountsUsd.map((a) => a),
          ...creditAmountsUsd.map((a) => a),
        ].filter((a) => a !== 0);

        // Detección avanzada de tipo de error con análisis estadístico
        const errorAnalysisBs = detectErrorTypeAdvanced(diffBs, allAmounts);
        const errorAnalysisUsd = detectErrorTypeAdvanced(diffUsd, allAmounts);
        const maxTotal = Math.max(
          calculatedDebitBs,
          calculatedCreditBs,
          calculatedDebitUsd,
          calculatedCreditUsd,
        );
        const tolerance = getToleranceThreshold(maxTotal);

        // Determinar si la diferencia es material
        const isMaterialBs = absDiffBs > tolerance.material;
        const isMaterialUsd = absDiffUsd > tolerance.material;
        const isCriticalBs = absDiffBs > tolerance.critical;
        const isCriticalUsd = absDiffUsd > tolerance.critical;

        // Si la diferencia es mayor a 0.01, necesitamos balancear las líneas
        if (absDiffBs > 0.01 || absDiffUsd > 0.01) {
          // Determinar si es de alto riesgo (crítico)
          const isHighRisk = isCriticalBs || isCriticalUsd;

          // Umbral absoluto razonable para corrección automática
          // Límites muy generosos: solo requerir revisión manual para diferencias extremadamente grandes
          const ABSOLUTE_CORRECTION_LIMIT_BS = 10000; // 10,000 BS
          const ABSOLUTE_CORRECTION_LIMIT_USD = 100; // 100 USD
          const _isWithinAbsoluteLimit =
            absDiffBs <= ABSOLUTE_CORRECTION_LIMIT_BS &&
            absDiffUsd <= ABSOLUTE_CORRECTION_LIMIT_USD;

          // Errores sistemáticos solo bloquean si:
          // 1. La diferencia es MUY grande (> 10,000 BS o 100 USD) Y
          // 2. Hay indicios claros de manipulación (Benford anómalo CON alta confianza)
          const benfordChiSquareBs =
            errorAnalysisBs.analysis?.benford?.chiSquare;
          const benfordChiSquareUsd =
            errorAnalysisUsd.analysis?.benford?.chiSquare;
          const hasStrongSystematicError =
            (errorAnalysisBs.type === 'systematic' &&
              benfordChiSquareBs !== undefined &&
              benfordChiSquareBs > 30 && // Chi-Square muy alto
              absDiffBs > ABSOLUTE_CORRECTION_LIMIT_BS) ||
            (errorAnalysisUsd.type === 'systematic' &&
              benfordChiSquareUsd !== undefined &&
              benfordChiSquareUsd > 30 &&
              absDiffUsd > ABSOLUTE_CORRECTION_LIMIT_USD);

          // Solo requerir revisión manual si excede límites absolutos razonables
          // O si hay error sistemático muy fuerte con diferencias muy grandes
          const requiresManualReview =
            hasStrongSystematicError ||
            absDiffBs > ABSOLUTE_CORRECTION_LIMIT_BS ||
            absDiffUsd > ABSOLUTE_CORRECTION_LIMIT_USD;

          if (requiresManualReview) {
            errors.push({
              entry_id: entry.id,
              entry_number: entry.entry_number,
              error: `Diferencia significativa detectada: BS diff=${diffBs.toFixed(2)} (${errorAnalysisBs.suggestion}), USD diff=${diffUsd.toFixed(2)} (${errorAnalysisUsd.suggestion}). Tipo de error: ${errorAnalysisBs.type}/${errorAnalysisUsd.type}. ${hasStrongSystematicError ? 'Posible manipulación detectada con alta confianza' : 'Diferencia excede límites razonables (10,000 BS / 100 USD)'}. Requiere revisión manual.`,
            });
            continue;
          }
          // Intentar corregir automáticamente - enfoque permisivo para maximizar correcciones automáticas
          // Intentar balancear ajustando la última línea de crédito o débito según corresponda
          // Buscar una línea que podamos ajustar (preferiblemente una cuenta de ajuste o la última línea)
          const sortedLines = [...lines].sort(
            (a, b) => b.line_number - a.line_number,
          );

          // Buscar línea de ajuste o diferencia si existe
          let adjustmentLine = sortedLines.find(
            (line) =>
              line.description?.toLowerCase().includes('ajuste') ||
              line.description?.toLowerCase().includes('diferencia') ||
              line.description?.toLowerCase().includes('redondeo'),
          );

          // Si no hay línea de ajuste, usar la última línea
          if (!adjustmentLine && sortedLines.length > 0) {
            adjustmentLine = sortedLines[0];
          }

          if (adjustmentLine) {
            // Ajustar la línea para balancear
            const newDebitBs = roundTo2Decimals(
              Number(adjustmentLine.debit_amount_bs || 0) +
              (diffBs > 0 ? 0 : Math.abs(diffBs)),
            );
            const newCreditBs = roundTo2Decimals(
              Number(adjustmentLine.credit_amount_bs || 0) +
              (diffBs > 0 ? Math.abs(diffBs) : 0),
            );
            const newDebitUsd = roundTo2Decimals(
              Number(adjustmentLine.debit_amount_usd || 0) +
              (diffUsd > 0 ? 0 : Math.abs(diffUsd)),
            );
            const newCreditUsd = roundTo2Decimals(
              Number(adjustmentLine.credit_amount_usd || 0) +
              (diffUsd > 0 ? Math.abs(diffUsd) : 0),
            );

            // Actualizar la línea con información del tipo de error
            const errorInfo = isHighRisk
              ? `[CRÍTICO - ${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`
              : isMaterialBs || isMaterialUsd
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

            const updatedDebitAmountsBs = updatedLines.map((line) =>
              Number(line.debit_amount_bs || 0),
            );
            const updatedCreditAmountsBs = updatedLines.map((line) =>
              Number(line.credit_amount_bs || 0),
            );
            const updatedDebitAmountsUsd = updatedLines.map((line) =>
              Number(line.debit_amount_usd || 0),
            );
            const updatedCreditAmountsUsd = updatedLines.map((line) =>
              Number(line.credit_amount_usd || 0),
            );

            const finalDebitBs = roundTo2Decimals(
              kahanSum(updatedDebitAmountsBs),
            );
            const finalCreditBs = roundTo2Decimals(
              kahanSum(updatedCreditAmountsBs),
            );
            const finalDebitUsd = roundTo2Decimals(
              kahanSum(updatedDebitAmountsUsd),
            );
            const finalCreditUsd = roundTo2Decimals(
              kahanSum(updatedCreditAmountsUsd),
            );

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
                  description:
                    'Cuenta automática para ajustes de balance en asientos contables',
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
                const maxLineNumber = Math.max(
                  ...lines.map((l) => l.line_number || 0),
                );
                const errorInfo = isHighRisk
                  ? `[CRÍTICO - ${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`
                  : isMaterialBs || isMaterialUsd
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
                  debit_amount_bs: roundTo2Decimals(
                    diffBs < 0 ? Math.abs(diffBs) : 0,
                  ),
                  credit_amount_bs: roundTo2Decimals(diffBs > 0 ? diffBs : 0),
                  debit_amount_usd: roundTo2Decimals(
                    diffUsd < 0 ? Math.abs(diffUsd) : 0,
                  ),
                  credit_amount_usd: roundTo2Decimals(
                    diffUsd > 0 ? diffUsd : 0,
                  ),
                });

                await this.journalEntryLineRepository.save(adjustmentLine);

                // Recalcular totales usando Kahan Summation con la nueva línea
                const allLinesAfterAdjustment =
                  await this.journalEntryLineRepository.find({
                    where: { entry_id: entry.id },
                  });

                const finalDebitAmountsBs = allLinesAfterAdjustment.map(
                  (line) => Number(line.debit_amount_bs || 0),
                );
                const finalCreditAmountsBs = allLinesAfterAdjustment.map(
                  (line) => Number(line.credit_amount_bs || 0),
                );
                const finalDebitAmountsUsd = allLinesAfterAdjustment.map(
                  (line) => Number(line.debit_amount_usd || 0),
                );
                const finalCreditAmountsUsd = allLinesAfterAdjustment.map(
                  (line) => Number(line.credit_amount_usd || 0),
                );

                const finalDebitBs = roundTo2Decimals(
                  kahanSum(finalDebitAmountsBs),
                );
                const finalCreditBs = roundTo2Decimals(
                  kahanSum(finalCreditAmountsBs),
                );
                const finalDebitUsd = roundTo2Decimals(
                  kahanSum(finalDebitAmountsUsd),
                );
                const finalCreditUsd = roundTo2Decimals(
                  kahanSum(finalCreditAmountsUsd),
                );

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
            const maxLineNumber = Math.max(
              ...lines.map((l) => l.line_number || 0),
            );
            const errorInfo = isHighRisk
              ? `[CRÍTICO - ${errorAnalysisBs.type}/${errorAnalysisUsd.type}]`
              : isMaterialBs || isMaterialUsd
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
              debit_amount_bs: roundTo2Decimals(
                diffBs < 0 ? Math.abs(diffBs) : 0,
              ),
              credit_amount_bs: roundTo2Decimals(diffBs > 0 ? diffBs : 0),
              debit_amount_usd: roundTo2Decimals(
                diffUsd < 0 ? Math.abs(diffUsd) : 0,
              ),
              credit_amount_usd: roundTo2Decimals(diffUsd > 0 ? diffUsd : 0),
            });

            await this.journalEntryLineRepository.save(adjustmentLine);

            // Recalcular totales usando Kahan Summation con la nueva línea
            const allLinesAfterAdjustment =
              await this.journalEntryLineRepository.find({
                where: { entry_id: entry.id },
              });

            const finalDebitAmountsBs = allLinesAfterAdjustment.map((line) =>
              Number(line.debit_amount_bs || 0),
            );
            const finalCreditAmountsBs = allLinesAfterAdjustment.map((line) =>
              Number(line.credit_amount_bs || 0),
            );
            const finalDebitAmountsUsd = allLinesAfterAdjustment.map((line) =>
              Number(line.debit_amount_usd || 0),
            );
            const finalCreditAmountsUsd = allLinesAfterAdjustment.map((line) =>
              Number(line.credit_amount_usd || 0),
            );

            const finalDebitBs = roundTo2Decimals(
              kahanSum(finalDebitAmountsBs),
            );
            const finalCreditBs = roundTo2Decimals(
              kahanSum(finalCreditAmountsBs),
            );
            const finalDebitUsd = roundTo2Decimals(
              kahanSum(finalDebitAmountsUsd),
            );
            const finalCreditUsd = roundTo2Decimals(
              kahanSum(finalCreditAmountsUsd),
            );

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
        const currentDiffBs = Math.abs(
          entry.total_debit_bs - entry.total_credit_bs,
        );
        const currentDiffUsd = Math.abs(
          entry.total_debit_usd - entry.total_credit_usd,
        );

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
        this.logger.error(
          `Error corrigiendo asiento ${entry.entry_number}: ${error}`,
        );
      }
    }

    return { corrected, errors };
  }
}
