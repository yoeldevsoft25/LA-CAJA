import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de promociones
 */
@Controller('promotions')
@UseGuards(JwtAuthGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  /**
   * Crea una nueva promoción
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPromotion(@Body() dto: CreatePromotionDto, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.promotionsService.createPromotion(storeId, dto);
  }

  /**
   * Obtiene todas las promociones activas
   */
  @Get('active')
  async getActivePromotions(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.promotionsService.getActivePromotions(storeId);
  }

  /**
   * Obtiene una promoción por ID
   */
  @Get(':id')
  async getPromotionById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.promotionsService.getPromotionById(storeId, id);
  }

  /**
   * Obtiene una promoción por código
   */
  @Get('code/:code')
  async getPromotionByCode(@Param('code') code: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.promotionsService.getPromotionByCode(storeId, code);
  }

  /**
   * Valida una promoción
   */
  @Post(':id/validate')
  async validatePromotion(
    @Param('id') id: string,
    @Body()
    body: {
      subtotal_bs: number;
      subtotal_usd: number;
      customer_id?: string | null;
    },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.promotionsService.validatePromotion(
      storeId,
      id,
      body.subtotal_bs,
      body.subtotal_usd,
      body.customer_id,
    );
  }

  /**
   * Obtiene promociones aplicables a productos
   */
  @Post('applicable')
  async getApplicablePromotions(
    @Body()
    body: {
      product_ids: string[];
      variant_ids?: (string | null)[];
    },
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.promotionsService.getApplicablePromotions(
      storeId,
      body.product_ids,
      body.variant_ids,
    );
  }
}
