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
  BadRequestException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { StockReceivedDto } from './dto/stock-received.dto';
import { StockAdjustedDto } from './dto/stock-adjusted.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApproveStockDto } from './dto/approve-stock.dto';
import { GetStockStatusDto } from './dto/get-stock-status.dto';
import { ReconcileStockDto } from './dto/reconcile-stock.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  private parseDateParam(value?: string): Date | undefined {
    if (!value) return undefined;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }

    return date;
  }

  @Post('stock/received')
  @Roles('owner')
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
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  async stockAdjusted(@Body() dto: StockAdjustedDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.stockAdjusted(storeId, dto, req.user.sub);
  }

  @Post('stock/approve')
  @Roles('owner')
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

  @Get('stock/health')
  @Roles('owner')
  async getInventoryHealth(@Request() req: any) {
    const storeId = req.user.store_id;
    const discrepancies = await this.inventoryService.verifyInventoryConsistency(storeId);
    return {
      ok: discrepancies.length === 0,
      count: discrepancies.length,
      discrepancies,
    };
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
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const storeId = req.user.store_id;
    const start = this.parseDateParam(startDate);
    const end = this.parseDateParam(endDate);
    return this.inventoryService.getMovements(
      storeId,
      productId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      includePending ? includePending === 'true' : true,
      start,
      end,
    );
  }

  @Post('stock/reconcile-physical')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async reconcilePhysicalStock(@Body() dto: ReconcileStockDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.reconcileStock(
      storeId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('stock/reconcile')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async reconcileStock(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.inventoryService.reconcileStockFromMovements(storeId, req.user.role);
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
  @Roles('owner')
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
  @Roles('owner')
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
