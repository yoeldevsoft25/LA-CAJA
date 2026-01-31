import { Controller, Get, Param, Query } from '@nestjs/common';
import { KitchenDisplayService } from './kitchen-display.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('public-kitchen')
@Controller('public/kitchen')
export class KitchenPublicController {
  constructor(private readonly kitchenDisplayService: KitchenDisplayService) {}

  @ApiOperation({ summary: 'Obtener órdenes activas para cocina (público)' })
  @Get(':token/orders')
  async getPublicKitchenOrders(
    @Param('token') token: string,
    @Query('pin') pin?: string,
  ) {
    return this.kitchenDisplayService.getPublicKitchenOrders(token, pin);
  }
}
