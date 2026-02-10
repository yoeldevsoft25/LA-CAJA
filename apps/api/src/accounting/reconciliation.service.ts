import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { FiscalInvoice } from '../database/entities/fiscal-invoice.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';

export interface ReconciliationResult {
  salesWithoutInvoice: string[];
  invoicesWithoutEntry: string[];
  discrepancies: Array<{
    type: 'amount_mismatch' | 'missing_entry';
    sourceId: string;
    description: string;
    expected: number;
    actual: number;
  }>;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(FiscalInvoice)
    private readonly fiscalInvoiceRepository: Repository<FiscalInvoice>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
  ) {}

  /**
   * Concilia las ventas con sus facturas fiscales y asientos contables
   * para un período determinado.
   */
  async reconcilePeriod(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ReconciliationResult> {
    this.logger.log(
      `Iniciando conciliación para tienda ${storeId} del ${startDate.toISOString()} al ${endDate.toISOString()}`,
    );

    const result: ReconciliationResult = {
      salesWithoutInvoice: [],
      invoicesWithoutEntry: [],
      discrepancies: [],
    };

    // 1. Obtener todas las ventas del período
    const sales = await this.saleRepository.find({
      where: {
        store_id: storeId,
        created_at: Between(startDate, endDate),
        voided_at: IsNull(),
      } as any,
    });

    // 2. Obtener todas las facturas del período
    const invoices = await this.fiscalInvoiceRepository.find({
      where: {
        store_id: storeId,
        created_at: Between(startDate, endDate),
        status: In(['draft', 'issued']),
      },
    });

    // 3. Obtener todos los asientos del período relacionados con ventas/facturas
    const entries = await this.journalEntryRepository.find({
      where: {
        store_id: storeId,
        entry_date: Between(startDate, endDate),
        source_type: In(['sale', 'fiscal_invoice']),
      },
    });

    const invoiceBySaleId = new Map<string, FiscalInvoice>();
    invoices.forEach((inv) => {
      if (inv.sale_id) invoiceBySaleId.set(inv.sale_id, inv);
    });

    const entryBySourceId = new Map<string, JournalEntry>();
    entries.forEach((entry) => {
      if (entry.source_id) entryBySourceId.set(entry.source_id, entry);
    });

    // Validar Ventas vs Facturas
    for (const sale of sales) {
      const invoice = invoiceBySaleId.get(sale.id);
      if (!invoice) {
        // Podría ser normal si la tienda no tiene facturación fiscal activa siempre
        result.salesWithoutInvoice.push(sale.id);
      }
    }

    // Validar Facturas Emitidas vs Asientos
    for (const invoice of invoices) {
      if (invoice.status === 'issued') {
        const entry = entryBySourceId.get(invoice.id);
        if (!entry) {
          result.invoicesWithoutEntry.push(invoice.id);
        } else {
          // Comparar montos (redondeo a 2 decimales para evitar floating point issues)
          const invTotal = Number(invoice.total_bs);
          const entryTotal = Number(entry.total_debit_bs);

          if (Math.abs(invTotal - entryTotal) > 0.01) {
            result.discrepancies.push({
              type: 'amount_mismatch',
              sourceId: invoice.id,
              description: `Diferencia en montos para factura ${invoice.invoice_number}`,
              expected: invTotal,
              actual: entryTotal,
            });
          }
        }
      }
    }

    this.logger.log(
      `Conciliación finalizada. Discrepancias encontradas: ${result.discrepancies.length}`,
    );
    return result;
  }
}
