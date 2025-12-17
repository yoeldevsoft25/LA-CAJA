import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CreatePartialPaymentDto } from './dto/create-partial-payment.dto';
import { MoveOrderDto } from './dto/move-order.dto';
import { MergeOrdersDto } from './dto/merge-orders.dto';
import { CreateSaleDto } from '../sales/dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de órdenes (cuentas abiertas)
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Crea una nueva orden
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() dto: CreateOrderDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.ordersService.createOrder(storeId, dto, userId);
  }

  /**
   * Obtiene todas las órdenes abiertas
   */
  @Get('open')
  async getOpenOrders(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.ordersService.getOpenOrders(storeId);
  }

  /**
   * Obtiene una orden por ID
   */
  @Get(':id')
  async getOrderById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.ordersService.getOrderById(storeId, id);
  }

  /**
   * Agrega un item a una orden
   */
  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  async addOrderItem(
    @Param('id') id: string,
    @Body() dto: AddOrderItemDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.ordersService.addOrderItem(storeId, id, dto);
  }

  /**
   * Elimina un item de una orden
   */
  @Put(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOrderItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    await this.ordersService.removeOrderItem(storeId, id, itemId);
  }

  /**
   * Pausa una orden
   */
  @Put(':id/pause')
  async pauseOrder(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.ordersService.pauseOrder(storeId, id);
  }

  /**
   * Reanuda una orden pausada
   */
  @Put(':id/resume')
  async resumeOrder(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.ordersService.resumeOrder(storeId, id);
  }

  /**
   * Mueve una orden a otra mesa
   */
  @Put(':id/move')
  async moveOrder(
    @Param('id') id: string,
    @Body() dto: MoveOrderDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.ordersService.moveOrder(storeId, id, dto);
  }

  /**
   * Fusiona múltiples órdenes
   */
  @Post('merge')
  async mergeOrders(@Body() dto: MergeOrdersDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.ordersService.mergeOrders(storeId, dto);
  }

  /**
   * Crea un pago parcial (recibo parcial)
   */
  @Post(':id/payments/partial')
  @HttpCode(HttpStatus.CREATED)
  async createPartialPayment(
    @Param('id') id: string,
    @Body() dto: CreatePartialPaymentDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.ordersService.createPartialPayment(storeId, id, dto, userId);
  }

  /**
   * Cierra una orden completa (genera venta final)
   */
  @Post(':id/close')
  async closeOrder(
    @Param('id') id: string,
    @Body() dto: CreateSaleDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.ordersService.closeOrder(storeId, id, dto, userId);
  }

  /**
   * Cancela una orden
   */
  @Put(':id/cancel')
  async cancelOrder(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.ordersService.cancelOrder(storeId, id);
  }
}
