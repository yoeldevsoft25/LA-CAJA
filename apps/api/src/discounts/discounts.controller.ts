import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountConfigsService } from './discount-configs.service';
import { DiscountAuthorizationsService } from './discount-authorizations.service';
import { DiscountRulesService } from './discount-rules.service';
import { CreateDiscountConfigDto } from './dto/create-discount-config.dto';
import { AuthorizeDiscountDto } from './dto/authorize-discount.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Sale } from '../database/entities/sale.entity';

/**
 * Controlador para gestión de descuentos y autorizaciones
 */
@Controller('discounts')
@UseGuards(JwtAuthGuard)
export class DiscountsController {
  constructor(
    private readonly configsService: DiscountConfigsService,
    private readonly authorizationsService: DiscountAuthorizationsService,
    private readonly rulesService: DiscountRulesService,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
  ) {}

  // ============================================
  // CONFIGURACIÓN DE DESCUENTOS
  // ============================================

  /**
   * Crea o actualiza configuración de descuentos
   */
  @Put('config')
  async upsertDiscountConfig(
    @Body() dto: CreateDiscountConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.configsService.upsertConfig(storeId, dto);
  }

  /**
   * Obtiene la configuración de descuentos
   */
  @Get('config')
  async getDiscountConfig(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.configsService.getConfig(storeId);
  }

  // ============================================
  // AUTORIZACIONES DE DESCUENTOS
  // ============================================

  /**
   * Autoriza un descuento en una venta
   */
  @Post('authorize')
  @HttpCode(HttpStatus.CREATED)
  async authorizeDiscount(
    @Body() dto: AuthorizeDiscountDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    const userRole = req.user.role || 'cashier';

    // Obtener la venta para calcular descuentos
    const sale = await this.saleRepository.findOne({
      where: { id: dto.sale_id, store_id: storeId },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    const totals = sale.totals as any;
    const discountBs = Number(totals.discount_bs || 0);
    const discountUsd = Number(totals.discount_usd || 0);
    const subtotalBs = Number(totals.subtotal_bs || 0);
    const subtotalUsd = Number(totals.subtotal_usd || 0);

    // Calcular porcentaje de descuento
    const discountPercentage =
      subtotalBs > 0
        ? (discountBs / subtotalBs) * 100
        : subtotalUsd > 0
          ? (discountUsd / subtotalUsd) * 100
          : 0;

    // Validar autorización
    const config = await this.rulesService.getOrCreateConfig(storeId);
    if (!this.rulesService.validateAuthorizationRole(userRole, config)) {
      throw new BadRequestException(
        `Tu rol (${userRole}) no tiene permisos para autorizar descuentos. Se requiere rol: ${config.authorization_role || 'supervisor'}`,
      );
    }

    // Validar PIN si se requiere
    if (dto.authorization_pin) {
      // Aquí deberías obtener el PIN hash del usuario autorizador
      // Por ahora, solo validamos que se proporcionó
    }

    return this.authorizationsService.createAuthorization(
      storeId,
      userId,
      userRole,
      dto,
      discountBs,
      discountUsd,
      discountPercentage,
    );
  }

  /**
   * Obtiene las autorizaciones de una venta
   */
  @Get('authorizations/sale/:saleId')
  async getAuthorizationsBySale(
    @Param('saleId') saleId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.authorizationsService.getAuthorizationsBySale(saleId, storeId);
  }

  /**
   * Obtiene todas las autorizaciones de la tienda
   */
  @Get('authorizations')
  async getAuthorizations(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.authorizationsService.getAuthorizations(
      storeId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Obtiene resumen de descuentos autorizados
   */
  @Get('summary')
  async getDiscountSummary(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.authorizationsService.getDiscountSummary(
      storeId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
