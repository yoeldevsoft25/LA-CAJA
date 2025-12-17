import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductSerialsService } from './product-serials.service';
import { CreateProductSerialDto } from './dto/create-product-serial.dto';
import { AssignSerialsDto } from './dto/assign-serials.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SerialStatus } from '../database/entities/product-serial.entity';

/**
 * Controlador para gestión de seriales de productos
 */
@Controller('product-serials')
@UseGuards(JwtAuthGuard)
export class ProductSerialsController {
  constructor(private readonly serialsService: ProductSerialsService) {}

  /**
   * Crea un nuevo serial de producto
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSerial(@Body() dto: CreateProductSerialDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.serialsService.createSerial(storeId, dto);
  }

  /**
   * Crea múltiples seriales en lote
   */
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createSerialsBatch(
    @Body()
    body: {
      product_id: string;
      serial_numbers: string[];
      received_at: string;
    },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.serialsService.createSerialsBatch(
      storeId,
      body.product_id,
      body.serial_numbers,
      new Date(body.received_at),
    );
  }

  /**
   * Obtiene todos los seriales de un producto
   */
  @Get('product/:productId')
  async getSerialsByProduct(
    @Param('productId') productId: string,
    @Query('status') status: SerialStatus,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.serialsService.getSerialsByProduct(storeId, productId, status);
  }

  /**
   * Obtiene un serial por su número
   */
  @Get('product/:productId/serial/:serialNumber')
  async getSerialByNumber(
    @Param('productId') productId: string,
    @Param('serialNumber') serialNumber: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.serialsService.getSerialByNumber(
      storeId,
      productId,
      serialNumber,
    );
  }

  /**
   * Obtiene seriales disponibles de un producto
   */
  @Get('product/:productId/available')
  async getAvailableSerials(
    @Param('productId') productId: string,
    @Query('quantity') quantity: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.serialsService.getAvailableSerials(
      storeId,
      productId,
      quantity ? parseInt(quantity, 10) : 1,
    );
  }

  /**
   * Asigna seriales a una venta
   */
  @Post('assign')
  @HttpCode(HttpStatus.OK)
  async assignSerialsToSale(
    @Body() dto: AssignSerialsDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.serialsService.assignSerialsToSale(storeId, dto);
  }

  /**
   * Marca un serial como devuelto
   */
  @Put(':id/return')
  async returnSerial(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.serialsService.returnSerial(storeId, id);
  }

  /**
   * Marca un serial como dañado
   */
  @Put(':id/damaged')
  async markSerialAsDamaged(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.serialsService.markSerialAsDamaged(storeId, id, body.note);
  }

  /**
   * Obtiene los seriales de una venta
   */
  @Get('sale/:saleId')
  async getSerialsBySale(@Param('saleId') saleId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.serialsService.getSerialsBySale(storeId, saleId);
  }

  /**
   * Obtiene los seriales de un item de venta
   */
  @Get('sale-item/:saleItemId')
  async getSerialsBySaleItem(
    @Param('saleItemId') saleItemId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.serialsService.getSerialsBySaleItem(storeId, saleItemId);
  }
}

