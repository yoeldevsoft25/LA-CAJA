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
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private parseDateParam(value?: string): Date | undefined {
    if (!value) return undefined;

    // Cuando llega en formato YYYY-MM-DD, `new Date(value)` se interpreta como UTC y
    // puede terminar en el día anterior/siguiente en hora local. Forzamos parse local.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);

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
}
