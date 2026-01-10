import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { StockReceivedDto } from './dto/stock-received.dto';
import { StockAdjustedDto } from './dto/stock-adjusted.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApproveStockDto } from './dto/approve-stock.dto';
import { GetStockStatusDto } from './dto/get-stock-status.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('stock/received')
  @HttpCode(HttpStatus.CREATED)
  async stockReceived(@Body() dto: StockReceivedDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.stockReceived(
      storeId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('stock/adjust')
  @HttpCode(HttpStatus.CREATED)
  async stockAdjusted(@Body() dto: StockAdjustedDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.stockAdjusted(storeId, dto, req.user.sub);
  }

  @Post('stock/approve')
  @HttpCode(HttpStatus.OK)
  async approveStock(@Body() dto: ApproveStockDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.approveReceivedMovement(
      storeId,
      dto.movement_id,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('stock/status')
  async getStockStatus(
    @Query() query: GetStockStatusDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const { items, total } = await this.inventoryService.getStockStatus(
      storeId,
      query,
    );

    const isPaginated = query.limit !== undefined || query.offset !== undefined;
    if (isPaginated) {
      return { items, total };
    }

    return items;
  }

  @Get('stock/low')
  async getLowStock(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.getLowStockProducts(storeId);
  }

  @Get('movements')
  async getMovements(
    @Query('product_id') productId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('include_pending') includePending: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.inventoryService.getMovements(
      storeId,
      productId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      includePending ? includePending === 'true' : true,
    );
  }

  @Get('stock/:productId')
  async getProductStock(
    @Param('productId') productId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const stock = await this.inventoryService.getCurrentStock(
      storeId,
      productId,
    );
    return { product_id: productId, current_stock: stock };
  }

  /**
   * Vaciar el stock de un producto específico (poner a 0)
   * Solo owners pueden ejecutar esta acción
   */
  @Post('stock/reset/:productId')
  @HttpCode(HttpStatus.OK)
  async resetProductStock(
    @Param('productId') productId: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const result = await this.inventoryService.resetProductStock(
      storeId,
      productId,
      req.user.sub,
      req.user.role,
      body.note,
    );
    return {
      ok: true,
      message: result
        ? 'Stock vaciado exitosamente'
        : 'El producto ya tiene stock en 0',
      movement: result,
    };
  }

  /**
   * Vaciar TODO el inventario de la tienda
   * Solo owners pueden ejecutar esta acción - PELIGROSO
   */
  @Post('stock/reset-all')
  @HttpCode(HttpStatus.OK)
  async resetAllStock(
    @Body() body: { note?: string; confirm?: boolean },
    @Request() req: any,
  ) {
    if (!body.confirm) {
      return {
        ok: false,
        message:
          'Debes confirmar esta acción enviando confirm: true. Esta acción es IRREVERSIBLE.',
      };
    }

    const storeId = req.user.store_id;
    const result = await this.inventoryService.resetAllStock(
      storeId,
      req.user.sub,
      req.user.role,
      body.note,
    );
    return {
      ok: true,
      message: `Se vació el stock de ${result.reset_count} productos`,
      reset_count: result.reset_count,
    };
  }
}
