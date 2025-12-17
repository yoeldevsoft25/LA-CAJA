import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoiceSeriesService } from './invoice-series.service';
import { CreateInvoiceSeriesDto } from './dto/create-invoice-series.dto';
import { UpdateInvoiceSeriesDto } from './dto/update-invoice-series.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de series de facturas
 */
@Controller('invoice-series')
@UseGuards(JwtAuthGuard)
export class InvoiceSeriesController {
  constructor(private readonly seriesService: InvoiceSeriesService) {}

  /**
   * Crea una nueva serie de factura
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSeries(@Body() dto: CreateInvoiceSeriesDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.seriesService.createSeries(storeId, dto);
  }

  /**
   * Obtiene todas las series de la tienda
   */
  @Get()
  async getSeriesByStore(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.seriesService.getSeriesByStore(storeId);
  }

  /**
   * Obtiene una serie por ID
   */
  @Get(':id')
  async getSeriesById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.seriesService.getSeriesById(storeId, id);
  }

  /**
   * Obtiene una serie por código
   */
  @Get('code/:code')
  async getSeriesByCode(@Param('code') code: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.seriesService.getSeriesByCode(storeId, code);
  }

  /**
   * Obtiene la serie por defecto (primera serie activa)
   */
  @Get('default/active')
  async getDefaultSeries(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.seriesService.getDefaultSeries(storeId);
  }

  /**
   * Actualiza una serie de factura
   */
  @Put(':id')
  async updateSeries(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceSeriesDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.seriesService.updateSeries(storeId, id, dto);
  }

  /**
   * Elimina una serie de factura
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSeries(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.seriesService.deleteSeries(storeId, id);
  }

  /**
   * Reinicia el consecutivo de una serie
   */
  @Put(':id/reset')
  async resetSeriesNumber(
    @Param('id') id: string,
    @Body() body: { new_number: number },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.seriesService.resetSeriesNumber(storeId, id, body.new_number);
  }
}
