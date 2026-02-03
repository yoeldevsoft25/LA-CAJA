import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SupplierPriceListsService } from './supplier-price-lists.service';
import { ImportSupplierPriceListDto } from './dto/import-supplier-price-list.dto';
import { SearchSupplierPriceItemsDto } from './dto/search-supplier-price-items.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('supplier-price-lists')
@UseGuards(JwtAuthGuard)
@Roles('owner')
export class SupplierPriceListsController {
  constructor(
    private readonly supplierPriceListsService: SupplierPriceListsService,
  ) {}

  @Post('import/csv')
  @HttpCode(HttpStatus.OK)
  async importCSV(
    @Body() dto: ImportSupplierPriceListDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.supplierPriceListsService.importFromCSV(storeId, dto);
  }

  @Get()
  async getLists(
    @Query('supplier_id') supplierId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.supplierPriceListsService.getLists(storeId, supplierId);
  }

  @Get('items')
  async searchItems(
    @Query() query: SearchSupplierPriceItemsDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.supplierPriceListsService.searchItems(storeId, query);
  }
}
