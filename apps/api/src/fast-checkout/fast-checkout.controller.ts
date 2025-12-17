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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FastCheckoutConfigsService } from './fast-checkout-configs.service';
import { QuickProductsService } from './quick-products.service';
import { FastCheckoutRulesService } from './fast-checkout-rules.service';
import { CreateFastCheckoutConfigDto } from './dto/create-fast-checkout-config.dto';
import { CreateQuickProductDto } from './dto/create-quick-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de modo caja rápida
 */
@Controller('fast-checkout')
@UseGuards(JwtAuthGuard)
export class FastCheckoutController {
  constructor(
    private readonly configsService: FastCheckoutConfigsService,
    private readonly quickProductsService: QuickProductsService,
    private readonly rulesService: FastCheckoutRulesService,
  ) {}

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  /**
   * Crea o actualiza configuración de caja rápida
   */
  @Put('config')
  async upsertFastCheckoutConfig(
    @Body() dto: CreateFastCheckoutConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.configsService.upsertConfig(storeId, dto);
  }

  /**
   * Obtiene la configuración de caja rápida
   */
  @Get('config')
  async getFastCheckoutConfig(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.configsService.getConfig(storeId);
  }

  // ============================================
  // PRODUCTOS RÁPIDOS
  // ============================================

  /**
   * Crea o actualiza un producto rápido
   */
  @Put('quick-products')
  async upsertQuickProduct(
    @Body() dto: CreateQuickProductDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.quickProductsService.upsertQuickProduct(storeId, dto);
  }

  /**
   * Obtiene todos los productos rápidos
   */
  @Get('quick-products')
  async getQuickProducts(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.quickProductsService.getQuickProducts(storeId);
  }

  /**
   * Obtiene un producto rápido por tecla
   */
  @Get('quick-products/key/:key')
  async getQuickProductByKey(@Param('key') key: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.quickProductsService.getQuickProductByKey(storeId, key);
  }

  /**
   * Elimina un producto rápido
   */
  @Delete('quick-products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuickProduct(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.quickProductsService.deleteQuickProduct(storeId, id);
  }

  /**
   * Desactiva un producto rápido
   */
  @Post('quick-products/:id/deactivate')
  async deactivateQuickProduct(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.quickProductsService.deactivateQuickProduct(storeId, id);
  }

  /**
   * Reordena productos rápidos
   */
  @Post('quick-products/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderQuickProducts(
    @Body() body: { quick_product_ids: string[] },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.quickProductsService.reorderQuickProducts(
      storeId,
      body.quick_product_ids,
    );
  }
}
