import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { KitchenDisplayService } from './kitchen-display.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para Kitchen Display System (KDS)
 */
@Controller('kitchen')
@UseGuards(JwtAuthGuard)
export class KitchenDisplayController {
  constructor(private readonly kitchenDisplayService: KitchenDisplayService) {}

  /**
   * GET /kitchen/orders
   * Obtiene todas las órdenes abiertas para la cocina
   */
  @Get('orders')
  async getKitchenOrders(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.kitchenDisplayService.getKitchenOrders(storeId);
  }

  /**
   * GET /kitchen/public-link
   * Obtiene (o crea) el enlace público para pantalla de cocina
   */
  @Get('public-link')
  async getPublicKitchenLink(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.kitchenDisplayService.getOrCreatePublicLink(storeId);
  }

  /**
   * POST /kitchen/public-link/rotate
   * Regenera el token público de cocina
   */
  @Post('public-link/rotate')
  async rotatePublicKitchenLink(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.kitchenDisplayService.rotatePublicToken(storeId);
  }

  /**
   * POST /kitchen/public-link/pin
   * Configura o limpia el PIN del enlace público de cocina
   */
  @Post('public-link/pin')
  async setPublicKitchenPin(
    @Body('pin') pin: string | undefined,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.kitchenDisplayService.setPublicPin(storeId, pin?.trim());
  }

  /**
   * GET /kitchen/orders/:id
   * Obtiene una orden específica para la cocina
   */
  @Get('orders/:id')
  async getKitchenOrder(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const order = await this.kitchenDisplayService.getKitchenOrder(storeId, id);
    if (!order) {
      return { success: false, message: 'Orden no encontrada' };
    }
    return { success: true, order };
  }

  /**
   * PUT /kitchen/orders/:orderId/items/:itemId/status
   * Actualiza el estado de un item de orden
   */
  @Put('orders/:orderId/items/:itemId/status')
  @HttpCode(HttpStatus.OK)
  async updateOrderItemStatus(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() body: { status: 'pending' | 'preparing' | 'ready' },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const updatedItem = await this.kitchenDisplayService.updateOrderItemStatus(
      storeId,
      orderId,
      itemId,
      body.status,
    );
    return {
      success: true,
      item: {
        id: updatedItem.id,
        status: updatedItem.status,
      },
    };
  }
}
