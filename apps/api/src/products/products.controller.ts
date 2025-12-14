import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ChangePriceDto } from './dto/change-price.dto';
import { BulkPriceChangeDto } from './dto/bulk-price-change.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.productsService.create(storeId, dto);
  }

  @Get()
  async findAll(@Query() searchDto: SearchProductsDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.productsService.findAll(storeId, searchDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.productsService.findOne(storeId, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.productsService.update(storeId, id, dto);
  }

  @Patch(':id/price')
  async changePrice(
    @Param('id') id: string,
    @Body() dto: ChangePriceDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.productsService.changePrice(storeId, id, dto);
  }

  @Put('prices/bulk')
  @HttpCode(HttpStatus.OK)
  async bulkPriceChange(@Body() dto: BulkPriceChangeDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.productsService.bulkPriceChange(storeId, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.productsService.deactivate(storeId, id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.productsService.activate(storeId, id);
  }

  @Post('import/csv')
  @HttpCode(HttpStatus.OK)
  async importCSV(@Body() body: { csv: string }, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.productsService.importFromCSV(storeId, body.csv);
  }
}

