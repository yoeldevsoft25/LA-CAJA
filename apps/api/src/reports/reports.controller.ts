import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Header,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly pdfService: PdfService,
  ) {}

  private parseDateParam(value?: string): Date | undefined {
    if (!value) return undefined;

    // Cuando llega en formato YYYY-MM-DD, parsear como fecha local (no UTC)
    // para evitar problemas de zona horaria al comparar con TIMESTAMPTZ
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      // Crear fecha en hora local (no UTC) para evitar cambios de día
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      return date;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }

    return date;
  }

  @Get('sales/by-day')
  async getSalesByDay(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getSalesByDay(storeId, start, end);
  }

  @Get('sales/top-products')
  async getTopProducts(
    @Query('limit') limit?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getTopProducts(storeId, limitNum, start, end);
  }

  @Get('debts/summary')
  async getDebtSummary(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.reportsService.getDebtSummary(storeId);
  }

  @Get('sales/export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=sales-export.csv')
  async exportSalesCSV(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    const csv = await this.reportsService.exportSalesCSV(storeId, start, end);
    return csv;
  }

  @Get('shifts')
  async getShiftsReport(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('cashier_id') cashierId?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getShiftsReport(storeId, start, end, cashierId);
  }

  @Get('arqueos')
  async getArqueosReport(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getArqueosReport(storeId, start, end);
  }

  @Get('expiring-products')
  async getExpiringProductsReport(
    @Query('days_ahead') daysAhead?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const days = daysAhead ? parseInt(daysAhead, 10) : 30;
    return this.reportsService.getExpiringProductsReport(storeId, days);
  }

  @Get('serials')
  async getSerialsReport(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getSerialsReport(storeId, start, end);
  }

  @Get('rotation')
  async getRotationReport(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getRotationReport(storeId, start, end);
  }

  @Get('sales/by-day/export/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=sales-by-day.pdf')
  async exportSalesByDayPDF(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    const pdf = await this.pdfService.generateSalesByDayPDF(
      storeId,
      start,
      end,
    );
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader(
      'Content-Disposition',
      'attachment; filename=sales-by-day.pdf',
    );
    res?.send(pdf);
  }

  @Get('shifts/export/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=shifts-report.pdf')
  async exportShiftsPDF(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('cashier_id') cashierId?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    const pdf = await this.pdfService.generateShiftsPDF(
      storeId,
      start,
      end,
      cashierId,
    );
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader(
      'Content-Disposition',
      'attachment; filename=shifts-report.pdf',
    );
    res?.send(pdf);
  }

  @Get('arqueos/export/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=arqueos-report.pdf')
  async exportArqueosPDF(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    const pdf = await this.pdfService.generateArqueosPDF(storeId, start, end);
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader(
      'Content-Disposition',
      'attachment; filename=arqueos-report.pdf',
    );
    res?.send(pdf);
  }

  @Get('expiring-products/export/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=expiring-products.pdf')
  async exportExpiringProductsPDF(
    @Query('days_ahead') daysAhead?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const storeId = req.user.store_id;
    const days = daysAhead ? parseInt(daysAhead, 10) : 30;
    const pdf = await this.pdfService.generateExpiringProductsPDF(
      storeId,
      days,
    );
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader(
      'Content-Disposition',
      'attachment; filename=expiring-products.pdf',
    );
    res?.send(pdf);
  }

  @Get('purchases/by-supplier')
  async getPurchasesBySupplier(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getPurchasesBySupplier(storeId, start, end);
  }

  @Get('fiscal-invoices')
  async getFiscalInvoicesReport(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.reportsService.getFiscalInvoicesReport(
      storeId,
      start,
      end,
      status,
    );
  }
}
