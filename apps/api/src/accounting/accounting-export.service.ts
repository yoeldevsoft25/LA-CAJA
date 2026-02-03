import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AccountingExport } from '../database/entities/accounting-export.entity';
import { JournalEntry } from '../database/entities/journal-entry.entity';
import { ExportAccountingDto } from './dto/export-accounting.dto';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AccountingExportService {
  private readonly exportsDir = path.join(process.cwd(), 'exports');

  constructor(
    @InjectRepository(AccountingExport)
    private exportRepository: Repository<AccountingExport>,
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
  ) {
    // Crear directorio de exports si no existe
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  /**
   * Exportar asientos contables
   */
  async exportAccounting(
    storeId: string,
    dto: ExportAccountingDto,
    userId: string,
  ): Promise<AccountingExport> {
    const exportRecord = this.exportRepository.create({
      id: randomUUID(),
      store_id: storeId,
      export_type: dto.export_type,
      format_standard: dto.format_standard || null,
      file_name: `accounting_export_${Date.now()}.${dto.export_type === 'excel' ? 'xlsx' : dto.export_type}`,
      status: 'processing',
      start_date: new Date(dto.start_date),
      end_date: new Date(dto.end_date),
      exported_by: userId,
    });

    await this.exportRepository.save(exportRecord);

    try {
      // Obtener asientos
      const entries = await this.journalEntryRepository.find({
        where: {
          store_id: storeId,
          entry_date: Between(new Date(dto.start_date), new Date(dto.end_date)),
          status: 'posted',
          ...(dto.entry_types && dto.entry_types.length > 0
            ? { entry_type: dto.entry_types[0] as any }
            : {}),
        },
        relations: ['lines'],
        order: { entry_date: 'ASC', entry_number: 'ASC' },
      });

      let filePath: string;

      switch (dto.export_type) {
        case 'csv':
          filePath = await this.exportToCSV(exportRecord.id, entries);
          break;
        case 'excel':
          filePath = await this.exportToExcel(exportRecord.id, entries);
          break;
        case 'json':
          filePath = await this.exportToJSON(exportRecord.id, entries);
          break;
        case 'viotech_sync':
          filePath = await this.exportToVioTechFormat(exportRecord.id, entries);
          break;
        default:
          throw new Error(
            `Tipo de exportación no soportado: ${dto.export_type}`,
          );
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      const totalAmountBs = entries.reduce(
        (sum, e) => sum + Number(e.total_debit_bs),
        0,
      );
      const totalAmountUsd = entries.reduce(
        (sum, e) => sum + Number(e.total_debit_usd),
        0,
      );

      exportRecord.file_path = filePath;
      exportRecord.file_size = fileSize;
      exportRecord.entries_count = entries.length;
      exportRecord.total_amount_bs = totalAmountBs;
      exportRecord.total_amount_usd = totalAmountUsd;
      exportRecord.status = 'completed';
      exportRecord.exported_at = new Date();

      await this.exportRepository.save(exportRecord);

      return exportRecord;
    } catch (error) {
      exportRecord.status = 'failed';
      exportRecord.error_message =
        error instanceof Error ? error.message : String(error);
      await this.exportRepository.save(exportRecord);
      throw error;
    }
  }

  /**
   * Exportar a CSV
   */
  private async exportToCSV(
    exportId: string,
    entries: JournalEntry[],
  ): Promise<string> {
    const filePath = path.join(this.exportsDir, `${exportId}.csv`);
    const lines: string[] = [];

    // Headers
    lines.push(
      'Fecha,Asiento,Tipo,Descripción,Cuenta,Código Cuenta,Nombre Cuenta,Débito BS,Crédito BS,Débito USD,Crédito USD',
    );

    // Data
    for (const entry of entries) {
      for (const line of entry.lines) {
        lines.push(
          [
            entry.entry_date.toISOString().split('T')[0],
            entry.entry_number,
            entry.entry_type,
            line.description || entry.description,
            line.account_code,
            line.account_code,
            line.account_name,
            line.debit_amount_bs.toFixed(2),
            line.credit_amount_bs.toFixed(2),
            line.debit_amount_usd.toFixed(2),
            line.credit_amount_usd.toFixed(2),
          ].join(','),
        );
      }
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    return filePath;
  }

  /**
   * Exportar a Excel
   */
  private async exportToExcel(
    exportId: string,
    entries: JournalEntry[],
  ): Promise<string> {
    const filePath = path.join(this.exportsDir, `${exportId}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asientos Contables');

    // Headers
    worksheet.columns = [
      { header: 'Fecha', key: 'date', width: 12 },
      { header: 'Asiento', key: 'entry_number', width: 15 },
      { header: 'Tipo', key: 'entry_type', width: 15 },
      { header: 'Descripción', key: 'description', width: 30 },
      { header: 'Código Cuenta', key: 'account_code', width: 15 },
      { header: 'Nombre Cuenta', key: 'account_name', width: 30 },
      { header: 'Débito BS', key: 'debit_bs', width: 15 },
      { header: 'Crédito BS', key: 'credit_bs', width: 15 },
      { header: 'Débito USD', key: 'debit_usd', width: 15 },
      { header: 'Crédito USD', key: 'credit_usd', width: 15 },
    ];

    // Data
    for (const entry of entries) {
      for (const line of entry.lines) {
        worksheet.addRow({
          date: entry.entry_date,
          entry_number: entry.entry_number,
          entry_type: entry.entry_type,
          description: line.description || entry.description,
          account_code: line.account_code,
          account_name: line.account_name,
          debit_bs: line.debit_amount_bs,
          credit_bs: line.credit_amount_bs,
          debit_usd: line.debit_amount_usd,
          credit_usd: line.credit_amount_usd,
        });
      }
    }

    // Formato de números
    worksheet.getColumn('debit_bs').numFmt = '#,##0.00';
    worksheet.getColumn('credit_bs').numFmt = '#,##0.00';
    worksheet.getColumn('debit_usd').numFmt = '#,##0.00';
    worksheet.getColumn('credit_usd').numFmt = '#,##0.00';

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * Exportar a JSON
   */
  private async exportToJSON(
    exportId: string,
    entries: JournalEntry[],
  ): Promise<string> {
    const filePath = path.join(this.exportsDir, `${exportId}.json`);
    const data = entries.map((entry) => ({
      entry_number: entry.entry_number,
      entry_date: entry.entry_date.toISOString().split('T')[0],
      entry_type: entry.entry_type,
      description: entry.description,
      reference_number: entry.reference_number,
      currency: entry.currency,
      exchange_rate: entry.exchange_rate,
      lines: entry.lines.map((line) => ({
        account_code: line.account_code,
        account_name: line.account_name,
        description: line.description,
        debit_amount_bs: line.debit_amount_bs,
        credit_amount_bs: line.credit_amount_bs,
        debit_amount_usd: line.debit_amount_usd,
        credit_amount_usd: line.credit_amount_usd,
        cost_center: line.cost_center,
        project_code: line.project_code,
        tax_code: line.tax_code,
      })),
    }));

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  /**
   * Exportar a formato VioTech (preparado para sincronización)
   */
  private async exportToVioTechFormat(
    exportId: string,
    entries: JournalEntry[],
  ): Promise<string> {
    const filePath = path.join(this.exportsDir, `${exportId}_viotech.json`);

    // Formato específico para VioTech core
    const viotechData = {
      version: '1.0',
      export_date: new Date().toISOString(),
      entries: entries.map((entry) => ({
        local_id: entry.id,
        entry_number: entry.entry_number,
        entry_date: entry.entry_date.toISOString().split('T')[0],
        entry_type: entry.entry_type,
        description: entry.description,
        reference_number: entry.reference_number,
        currency: entry.currency,
        exchange_rate: entry.exchange_rate,
        source_type: entry.source_type,
        source_id: entry.source_id,
        lines: entry.lines.map((line) => ({
          account_code: line.account_code,
          account_name: line.account_name,
          description: line.description,
          debit_amount_bs: line.debit_amount_bs,
          credit_amount_bs: line.credit_amount_bs,
          debit_amount_usd: line.debit_amount_usd,
          credit_amount_usd: line.credit_amount_usd,
          cost_center: line.cost_center,
          project_code: line.project_code,
          tax_code: line.tax_code,
        })),
        metadata: entry.metadata,
      })),
    };

    fs.writeFileSync(filePath, JSON.stringify(viotechData, null, 2), 'utf-8');
    return filePath;
  }

  /**
   * Obtener exportaciones
   */
  async getExports(
    storeId: string,
    limit: number = 20,
  ): Promise<AccountingExport[]> {
    return this.exportRepository.find({
      where: { store_id: storeId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Descargar archivo de exportación
   */
  async getExportFile(
    storeId: string,
    exportId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const exportRecord = await this.exportRepository.findOne({
      where: { id: exportId, store_id: storeId },
    });

    if (!exportRecord) {
      throw new NotFoundException('Exportación no encontrada');
    }

    if (exportRecord.status !== 'completed' || !exportRecord.file_path) {
      throw new BadRequestException(
        'La exportación no está completa o no tiene archivo',
      );
    }

    if (!fs.existsSync(exportRecord.file_path)) {
      throw new NotFoundException('El archivo de exportación no existe');
    }

    return {
      filePath: exportRecord.file_path,
      fileName: exportRecord.file_name,
    };
  }
}
