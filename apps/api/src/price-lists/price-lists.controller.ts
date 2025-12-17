import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PriceListsService } from './price-lists.service';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { CreatePriceListItemDto } from './dto/create-price-list-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de listas de precio
 */
@Controller('price-lists')
@UseGuards(JwtAuthGuard)
export class PriceListsController {
  constructor(private readonly priceListsService: PriceListsService) {}

  /**
   * Crea una nueva lista de precio
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPriceList(@Body() dto: CreatePriceListDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.priceListsService.createPriceList(storeId, dto);
  }

  /**
   * Obtiene todas las listas de precio
   */
  @Get()
  async getPriceListsByStore(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.priceListsService.getPriceListsByStore(storeId);
  }

  /**
   * Obtiene la lista de precio por defecto
   */
  @Get('default')
  async getDefaultPriceList(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.priceListsService.getDefaultPriceList(storeId);
  }

  /**
   * Obtiene una lista por ID
   */
  @Get(':id')
  async getPriceListById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.priceListsService.getPriceListById(storeId, id);
  }

  /**
   * Agrega un item a una lista de precio
   */
  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  async addPriceListItem(
    @Param('id') id: string,
    @Body() dto: CreatePriceListItemDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.priceListsService.addPriceListItem(storeId, id, dto);
  }
}
