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
  Query,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('warehouses')
@UseGuards(JwtAuthGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  async create(@Body() dto: CreateWarehouseDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.warehousesService.create(storeId, dto);
  }

  @Get()
  async findAll(
    @Query('include_inactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const include = includeInactive === 'true';
    return this.warehousesService.findAll(storeId, include);
  }

  @Get('default')
  async getDefault(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.warehousesService.getDefault(storeId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.warehousesService.findOne(storeId, id);
  }

  @Get(':id/stock')
  async getStock(
    @Param('id') id: string,
    @Query('product_id') productId?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    return this.warehousesService.getStock(storeId, id, productId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.warehousesService.update(storeId, id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.warehousesService.remove(storeId, id);
    return { message: 'Bodega eliminada correctamente' };
  }
}
