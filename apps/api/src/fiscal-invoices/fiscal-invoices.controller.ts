import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FiscalInvoicesService } from './fiscal-invoices.service';
import { CreateFiscalInvoiceDto } from './dto/create-fiscal-invoice.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SeniatAuditGuard } from './guards/seniat-audit.guard';

@Controller('fiscal-invoices')
export class FiscalInvoicesController {
  constructor(private readonly fiscalInvoicesService: FiscalInvoicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateFiscalInvoiceDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.fiscalInvoicesService.create(storeId, dto, userId);
  }

  @Post('from-sale/:saleId')
  @UseGuards(JwtAuthGuard)
  async createFromSale(@Param('saleId') saleId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.fiscalInvoicesService.createFromSale(storeId, saleId, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('status') status?: string, @Request() req?: any) {
    const storeId = req.user.store_id;
    return this.fiscalInvoicesService.findAll(storeId, status as any);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalInvoicesService.findOne(storeId, id);
  }

  @Put(':id/issue')
  @UseGuards(JwtAuthGuard)
  async issue(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalInvoicesService.issue(storeId, id);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalInvoicesService.cancel(storeId, id);
  }

  /**
   * Crea una nota de crédito que anula la factura indicada.
   * Solo aplica a facturas emitidas. Según SENIAT, no se pueden cancelar
   * directamente; debe usarse una nota de crédito.
   */
  @Post(':id/credit-note')
  @UseGuards(JwtAuthGuard)
  async createCreditNote(
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id ?? req.user.sub;
    return this.fiscalInvoicesService.createCreditNote(
      storeId,
      id,
      userId,
      dto?.reason,
    );
  }

  @Get('by-sale/:saleId')
  @UseGuards(JwtAuthGuard)
  async findBySale(@Param('saleId') saleId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.fiscalInvoicesService.findBySale(storeId, saleId);
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  async getStatistics(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.fiscalInvoicesService.getStatistics(storeId, start, end);
  }

  /**
   * Endpoint de auditoría para el SENIAT
   *
   * Permite al SENIAT consultar facturas fiscales emitidas.
   * Requiere autenticación mediante clave de auditoría en header 'x-seniat-audit-key'.
   *
   * NOTA: Este endpoint NO requiere JWT de usuario normal, sino una clave especial
   * configurada en variables de entorno (SENIAT_AUDIT_KEY).
   *
   * El SENIAT debe enviar el store_id o RIF en el query parameter.
   */
  @Get('audit')
  @UseGuards(SeniatAuditGuard)
  async audit(
    @Query('store_id') storeId: string,
    @Query('fiscal_number') fiscalNumber?: string,
    @Query('invoice_number') invoiceNumber?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('store_id requerido para auditoría');
    }

    const queryParams = {
      fiscal_number: fiscalNumber,
      invoice_number: invoiceNumber,
      start_date: startDate ? new Date(startDate) : undefined,
      end_date: endDate ? new Date(endDate) : undefined,
      status: status as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    return this.fiscalInvoicesService.audit(storeId, queryParams);
  }
}
