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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  async create(@Body() dto: CreateSupplierDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.suppliersService.create(storeId, dto);
  }

  @Get()
  async findAll(
    @Query('include_inactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    const include = includeInactive === 'true';
    return this.suppliersService.findAll(storeId, include);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.suppliersService.findOne(storeId, id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.suppliersService.update(storeId, id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.suppliersService.remove(storeId, id);
    return { message: 'Proveedor eliminado correctamente' };
  }

  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.suppliersService.getStatistics(storeId, id);
  }

  @Get(':id/purchase-orders')
  async getPurchaseOrders(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    const storeId = req.user.store_id;
    return this.suppliersService.getPurchaseOrders(storeId, id, status);
  }
}
