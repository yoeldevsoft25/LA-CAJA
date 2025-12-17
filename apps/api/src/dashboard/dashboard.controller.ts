import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  private parseDateParam(value?: string): Date | undefined {
    if (!value) return undefined;

    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }

    return date;
  }

  @Get('kpis')
  async getKPIs(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    try {
      const storeId = req.user.store_id;
      const start = this.parseDateParam(startDate);
      const end = this.parseDateParam(endDate);
      return await this.dashboardService.getKPIs(storeId, start, end);
    } catch (error) {
      this.logger.error('Error al obtener KPIs del dashboard', error);
      throw new InternalServerErrorException(
        'Error al obtener los KPIs del dashboard',
      );
    }
  }

  @Get('trends')
  async getTrends(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.dashboardService.getTrends(storeId);
  }
}
