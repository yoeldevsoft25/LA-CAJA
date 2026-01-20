import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { PublicOrdersService } from '../orders/public-orders.service';

/**
 * Controlador público para menú QR
 * Endpoints sin autenticación para acceso desde códigos QR
 */
@Controller('public/menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly publicOrdersService: PublicOrdersService,
  ) {}

  /**
   * GET /public/menu/qr/:qrCode
   * Obtiene información de la mesa y menú a partir de un código QR
   */
  @Get('qr/:qrCode')
  async getMenuByQR(@Param('qrCode') qrCode: string) {
    try {
      const { table, qrCode: qrCodeEntity } =
        await this.menuService.validateQRCode(qrCode);

      const menu = await this.menuService.getPublicMenu(table.store_id);

      return {
        success: true,
        table: {
          id: table.id,
          table_number: table.table_number,
          name: table.name,
          capacity: table.capacity,
          zone: table.zone,
        },
        menu,
        qr_code: qrCode,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new NotFoundException('Error al obtener el menú');
    }
  }

  /**
   * GET /public/menu/products/:productId
   * Obtiene información detallada de un producto
   * Requiere qrCode como query param para identificar la tienda
   */
  @Get('products/:productId')
  async getProduct(
    @Param('productId') productId: string,
    @Query('qrCode') qrCode?: string,
  ) {
    try {
      // Si se proporciona QR, validar y obtener store_id
      if (!qrCode) {
        throw new BadRequestException('Código QR requerido');
      }

      const { table } = await this.menuService.validateQRCode(qrCode);
      const product = await this.menuService.getPublicProduct(
        table.store_id,
        productId,
      );

      return {
        success: true,
        product,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new NotFoundException('Producto no encontrado');
    }
  }

  /**
   * POST /public/menu/orders
   * Crea una orden desde el menú público
   */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() dto: { qr_code: string; items: Array<{ product_id: string; qty: number; note?: string | null }> }) {
    try {
      const order = await this.publicOrdersService.createOrderFromMenu(dto);
      return {
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          table_id: order.table_id,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al crear la orden');
    }
  }

  /**
   * GET /public/menu/orders/current
   * Obtiene la orden actual de una mesa por código QR
   */
  @Get('orders/current')
  async getCurrentOrder(@Query('qr_code') qrCode: string) {
    try {
      if (!qrCode) {
        throw new BadRequestException('Código QR requerido');
      }

      const { order, items } = await this.publicOrdersService.getCurrentOrderByQR(qrCode);

      if (!order) {
        return {
          success: true,
          has_order: false,
          order: null,
          items: [],
        };
      }

      // Calcular progreso
      const totalItems = items.length;
      const pendingItems = items.filter((item) => item.status === 'pending').length;
      const preparingItems = items.filter((item) => item.status === 'preparing').length;
      const readyItems = items.filter((item) => item.status === 'ready').length;

      return {
        success: true,
        has_order: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          opened_at: order.opened_at.toISOString(),
        },
        items,
        progress: {
          totalItems,
          pendingItems,
          preparingItems,
          readyItems,
          orderStatus: order.status,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Error al obtener la orden');
    }
  }
}
