import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductLotsService } from './product-lots.service';
import { CreateProductLotDto } from './dto/create-product-lot.dto';
import { CreateLotMovementDto } from './dto/create-lot-movement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de lotes de productos
 */
@Controller('product-lots')
@UseGuards(JwtAuthGuard)
export class ProductLotsController {
  constructor(private readonly lotsService: ProductLotsService) {}

  /**
   * Crea un nuevo lote de producto
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createLot(@Body() dto: CreateProductLotDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.lotsService.createLot(storeId, dto);
  }

  /**
   * Obtiene todos los lotes de un producto
   */
  @Get('product/:productId')
  async getLotsByProduct(
    @Param('productId') productId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.lotsService.getLotsByProduct(storeId, productId);
  }

  /**
   * Obtiene un lote por su ID
   */
  @Get(':id')
  async getLotById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.lotsService.getLotById(storeId, id);
  }

  /**
   * Obtiene lotes próximos a vencer
   */
  @Get('expiring/soon')
  async getLotsExpiringSoon(
    @Query('days') days: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.lotsService.getLotsExpiringSoon(
      storeId,
      days ? parseInt(days, 10) : 30,
    );
  }

  /**
   * Obtiene lotes vencidos
   */
  @Get('expired')
  async getExpiredLots(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.lotsService.getExpiredLots(storeId);
  }

  /**
   * Crea un movimiento de lote
   */
  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  async createLotMovement(
    @Body() dto: CreateLotMovementDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.lotsService.createLotMovement(storeId, dto);
  }

  /**
   * Obtiene los movimientos de un lote
   */
  @Get(':id/movements')
  async getLotMovements(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.lotsService.getLotMovements(storeId, id);
  }
}

