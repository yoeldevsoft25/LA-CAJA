import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { ReportsService } from './reports.service';

/**
 * Servicio para generar reportes en PDF
 */
@Injectable()
export class PdfService {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Genera un PDF de reporte de ventas por día
   */
  async generateSalesByDayPDF(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
    storeName?: string,
  ): Promise<Buffer> {
    const report = await this.reportsService.getSalesByDay(
      storeId,
      startDate,
      endDate,
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc.fontSize(20).text('Reporte de Ventas por Día', { align: 'center' });
      if (storeName) {
        doc.fontSize(14).text(storeName, { align: 'center' });
      }
      if (startDate || endDate) {
        const dateRange = `${startDate ? startDate.toLocaleDateString('es-VE') : 'Inicio'} - ${endDate ? endDate.toLocaleDateString('es-VE') : 'Fin'}`;
        doc.fontSize(12).text(dateRange, { align: 'center' });
      }
      doc.moveDown();

      // Resumen
      doc.fontSize(14).text('Resumen General', { underline: true });
      doc.fontSize(12);
      doc.text(`Total de Ventas: ${report.total_sales}`);
      doc.text(`Total BS: ${report.total_amount_bs.toFixed(2)}`);
      doc.text(`Total USD: ${report.total_amount_usd.toFixed(2)}`);
      doc.text(`Costo Total BS: ${report.total_cost_bs.toFixed(2)}`);
      doc.text(`Costo Total USD: ${report.total_cost_usd.toFixed(2)}`);
      doc.text(`Ganancia BS: ${report.total_profit_bs.toFixed(2)}`);
      doc.text(`Ganancia USD: ${report.total_profit_usd.toFixed(2)}`);
      doc.text(`Margen de Ganancia: ${report.profit_margin.toFixed(2)}%`);
      doc.moveDown();

      // Por método de pago
      doc.fontSize(14).text('Por Método de Pago', { underline: true });
      doc.fontSize(12);
      for (const [method, data] of Object.entries(report.by_payment_method)) {
        doc.text(
          `${method}: ${data.count} ventas - BS: ${data.amount_bs.toFixed(2)} - USD: ${data.amount_usd.toFixed(2)}`,
        );
      }
      doc.moveDown();

      // Por día
      doc.fontSize(14).text('Ventas por Día', { underline: true });
      doc.fontSize(10);
      doc.text(
        'Fecha | Ventas | Total BS | Total USD | Ganancia BS | Ganancia USD',
        { underline: true },
      );
      for (const day of report.daily) {
        doc.text(
          `${day.date} | ${day.sales_count} | ${day.total_bs.toFixed(2)} | ${day.total_usd.toFixed(2)} | ${day.profit_bs.toFixed(2)} | ${day.profit_usd.toFixed(2)}`,
        );
      }

      doc.end();
    });
  }

  /**
   * Genera un PDF de reporte de turnos
   */
  async generateShiftsPDF(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
    cashierId?: string,
    storeName?: string,
  ): Promise<Buffer> {
    const report = await this.reportsService.getShiftsReport(
      storeId,
      startDate,
      endDate,
      cashierId,
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc.fontSize(20).text('Reporte de Turnos', { align: 'center' });
      if (storeName) {
        doc.fontSize(14).text(storeName, { align: 'center' });
      }
      if (startDate || endDate) {
        const dateRange = `${startDate ? startDate.toLocaleDateString('es-VE') : 'Inicio'} - ${endDate ? endDate.toLocaleDateString('es-VE') : 'Fin'}`;
        doc.fontSize(12).text(dateRange, { align: 'center' });
      }
      doc.moveDown();

      // Resumen
      doc.fontSize(14).text('Resumen General', { underline: true });
      doc.fontSize(12);
      doc.text(`Total de Turnos: ${report.total_shifts}`);
      doc.text(`Total Ventas BS: ${report.total_sales_bs.toFixed(2)}`);
      doc.text(`Total Ventas USD: ${report.total_sales_usd.toFixed(2)}`);
      doc.text(
        `Total Diferencias BS: ${report.total_differences_bs.toFixed(2)}`,
      );
      doc.text(
        `Total Diferencias USD: ${report.total_differences_usd.toFixed(2)}`,
      );
      doc.moveDown();

      // Por cajero
      doc.fontSize(14).text('Por Cajero', { underline: true });
      doc.fontSize(12);
      for (const cashier of report.by_cashier) {
        doc.text(
          `${cashier.cashier_name}: ${cashier.shifts_count} turnos - Ventas BS: ${cashier.total_sales_bs.toFixed(2)} - Diferencias BS: ${cashier.total_differences_bs.toFixed(2)}`,
        );
      }
      doc.moveDown();

      // Turnos
      doc.fontSize(14).text('Detalle de Turnos', { underline: true });
      doc.fontSize(10);
      for (const shift of report.shifts.slice(0, 50)) {
        // Limitar a 50 turnos
        doc.text(
          `Turno ${shift.shift_id.substring(0, 8)} - ${shift.cashier_name} - ${shift.opened_at.toLocaleDateString('es-VE')} - Ventas: ${shift.sales_count} - BS: ${shift.total_sales_bs.toFixed(2)}`,
        );
      }

      doc.end();
    });
  }

  /**
   * Genera un PDF de reporte de arqueos
   */
  async generateArqueosPDF(
    storeId: string,
    startDate?: Date,
    endDate?: Date,
    storeName?: string,
  ): Promise<Buffer> {
    const report = await this.reportsService.getArqueosReport(
      storeId,
      startDate,
      endDate,
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc.fontSize(20).text('Reporte de Arqueos', { align: 'center' });
      if (storeName) {
        doc.fontSize(14).text(storeName, { align: 'center' });
      }
      if (startDate || endDate) {
        const dateRange = `${startDate ? startDate.toLocaleDateString('es-VE') : 'Inicio'} - ${endDate ? endDate.toLocaleDateString('es-VE') : 'Fin'}`;
        doc.fontSize(12).text(dateRange, { align: 'center' });
      }
      doc.moveDown();

      // Resumen
      doc.fontSize(14).text('Resumen General', { underline: true });
      doc.fontSize(12);
      doc.text(`Total de Arqueos: ${report.total_arqueos}`);
      doc.text(`Turnos con Diferencias: ${report.shifts_with_differences}`);
      doc.text(`Turnos sin Diferencias: ${report.shifts_without_differences}`);
      doc.text(
        `Total Diferencias BS: ${report.total_differences_bs.toFixed(2)}`,
      );
      doc.text(
        `Total Diferencias USD: ${report.total_differences_usd.toFixed(2)}`,
      );
      doc.moveDown();

      // Por cajero
      doc.fontSize(14).text('Por Cajero', { underline: true });
      doc.fontSize(12);
      for (const cashier of report.by_cashier) {
        doc.text(
          `${cashier.cashier_name}: ${cashier.arqueos_count} arqueos - Diferencias BS: ${cashier.total_differences_bs.toFixed(2)}`,
        );
      }
      doc.moveDown();

      // Arqueos
      doc.fontSize(14).text('Detalle de Arqueos', { underline: true });
      doc.fontSize(10);
      for (const arqueo of report.arqueos.slice(0, 50)) {
        // Limitar a 50 arqueos
        doc.text(
          `Turno ${arqueo.shift_id.substring(0, 8)} - ${arqueo.cashier_name} - ${arqueo.closed_at.toLocaleDateString('es-VE')} - Esperado BS: ${arqueo.expected_bs.toFixed(2)} - Contado BS: ${arqueo.counted_bs.toFixed(2)} - Diferencia BS: ${arqueo.difference_bs.toFixed(2)}`,
        );
      }

      doc.end();
    });
  }

  /**
   * Genera un PDF de productos próximos a vencer
   */
  async generateExpiringProductsPDF(
    storeId: string,
    daysAhead: number = 30,
    storeName?: string,
  ): Promise<Buffer> {
    const report = await this.reportsService.getExpiringProductsReport(
      storeId,
      daysAhead,
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc.fontSize(20).text('Productos Próximos a Vencer', { align: 'center' });
      if (storeName) {
        doc.fontSize(14).text(storeName, { align: 'center' });
      }
      doc.fontSize(12).text(`Próximos ${daysAhead} días`, { align: 'center' });
      doc.moveDown();

      // Resumen
      doc.fontSize(14).text('Resumen General', { underline: true });
      doc.fontSize(12);
      doc.text(`Total de Lotes: ${report.total_lots}`);
      doc.text(`Total Cantidad: ${report.total_quantity}`);
      doc.text(`Valor Total BS: ${report.total_value_bs.toFixed(2)}`);
      doc.text(`Valor Total USD: ${report.total_value_usd.toFixed(2)}`);
      doc.moveDown();

      // Por producto
      doc.fontSize(14).text('Por Producto', { underline: true });
      doc.fontSize(12);
      for (const product of report.by_product) {
        doc.text(
          `${product.product_name}: ${product.lots_count} lotes - ${product.total_quantity} unidades`,
        );
        for (const exp of product.expiration_dates) {
          doc
            .fontSize(10)
            .text(
              `  - Lote ${exp.lot_number}: ${exp.quantity} unidades - Vence: ${exp.expiration_date.toLocaleDateString('es-VE')} (${exp.days_until_expiration} días)`,
              { indent: 20 },
            );
        }
        doc.moveDown(0.5);
      }

      doc.end();
    });
  }
}
