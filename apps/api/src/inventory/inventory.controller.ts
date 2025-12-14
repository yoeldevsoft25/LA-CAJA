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

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('stock/received')
  @HttpCode(HttpStatus.CREATED)
  async stockReceived(@Body() dto: StockReceivedDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.stockReceived(storeId, dto);
  }

  @Post('stock/adjust')
  @HttpCode(HttpStatus.CREATED)
  async stockAdjusted(@Body() dto: StockAdjustedDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.stockAdjusted(storeId, dto);
  }

  @Get('stock/status')
  async getStockStatus(@Query('product_id') productId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.getStockStatus(storeId, productId);
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
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.inventoryService.getMovements(
      storeId,
      productId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('stock/:productId')
  async getProductStock(@Param('productId') productId: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const stock = await this.inventoryService.getCurrentStock(storeId, productId);
    return { product_id: productId, current_stock: stock };
  }
}

