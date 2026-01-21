import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
  Body,
  Request,
  Param,
  Logger,
} from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetManualRateDto } from './dto/set-manual-rate.dto';
import { UpdateRateConfigDto } from './dto/update-rate-config.dto';
import { SetMultipleRatesDto } from './dto/set-multiple-rates.dto';
import { ExchangeRateType } from '../database/entities/exchange-rate.entity';

@Controller('exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  private readonly logger = new Logger(ExchangeController.name);

  constructor(private readonly exchangeService: ExchangeService) {}

  // ============================================
  // ENDPOINTS MULTI-TASA
  // ============================================

  /**
   * Obtiene todas las tasas activas de la tienda
   */
  @Get('rates')
  async getAllRates(@Request() req: any) {
    const storeId = req.user.store_id;
    const rates = await this.exchangeService.getAllActiveRates(storeId);

    return {
      rates,
      available: rates.bcv !== null,
    };
  }

  /**
   * Obtiene una tasa específica por tipo
   */
  @Get('rates/:type')
  async getRateByType(@Param('type') type: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const rateType = type.toUpperCase() as ExchangeRateType;

    if (!['BCV', 'PARALLEL', 'CASH', 'ZELLE'].includes(rateType)) {
      return {
        rate: null,
        available: false,
        message: 'Tipo de tasa inválido',
      };
    }

    const rate = await this.exchangeService.getRateByType(storeId, rateType);

    return {
      rate,
      rate_type: rateType,
      available: rate !== null,
    };
  }

  /**
   * Obtiene la tasa apropiada para un método de pago
   */
  @Get('rates/for-method/:method')
  async getRateForMethod(@Param('method') method: string, @Request() req: any) {
    const storeId = req.user.store_id;
    const result = await this.exchangeService.getRateForPaymentMethod(
      storeId,
      method.toUpperCase(),
    );

    if (result) {
      return {
        rate: result.rate,
        rate_type: result.rateType,
        method: method.toUpperCase(),
        available: true,
      };
    }

    return {
      rate: null,
      rate_type: null,
      method: method.toUpperCase(),
      available: false,
    };
  }

  /**
   * Establece múltiples tasas a la vez
   */
  @Post('rates/bulk')
  async setMultipleRates(@Body() dto: SetMultipleRatesDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;

    const results: Array<{
      id: string;
      rate: number;
      rate_type: ExchangeRateType;
      is_preferred: boolean;
      effective_from: Date;
    }> = [];

    for (const rateItem of dto.rates) {
      const saved = await this.exchangeService.setManualRate(
        storeId,
        rateItem.rate,
        userId,
        undefined,
        undefined,
        rateItem.note,
        rateItem.rate_type,
        rateItem.is_preferred ?? true,
      );

      results.push({
        id: saved.id,
        rate: Number(saved.rate),
        rate_type: saved.rate_type,
        is_preferred: saved.is_preferred,
        effective_from: saved.effective_from,
      });
    }

    return { rates: results };
  }

  // ============================================
  // CONFIGURACIÓN DE TIENDA
  // ============================================

  /**
   * Obtiene la configuración de tasas de la tienda
   */
  @Get('config')
  async getRateConfig(@Request() req: any) {
    const storeId = req.user.store_id;
    const config = await this.exchangeService.getStoreRateConfig(storeId);

    return {
      config: {
        // Tasas por método
        cash_usd_rate_type: config.cash_usd_rate_type,
        cash_bs_rate_type: config.cash_bs_rate_type,
        pago_movil_rate_type: config.pago_movil_rate_type,
        transfer_rate_type: config.transfer_rate_type,
        point_of_sale_rate_type: config.point_of_sale_rate_type,
        zelle_rate_type: config.zelle_rate_type,
        // Redondeo
        rounding_mode: config.rounding_mode,
        rounding_precision: config.rounding_precision,
        // Cambio
        prefer_change_in: config.prefer_change_in,
        auto_convert_small_change: config.auto_convert_small_change,
        small_change_threshold_usd: Number(config.small_change_threshold_usd),
        // Sobrepago
        allow_overpayment: config.allow_overpayment,
        max_overpayment_usd: Number(config.max_overpayment_usd),
        overpayment_action: config.overpayment_action,
      },
    };
  }

  /**
   * Actualiza la configuración de tasas de la tienda
   */
  @Put('config')
  async updateRateConfig(
    @Body() dto: UpdateRateConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const config = await this.exchangeService.updateStoreRateConfig(
      storeId,
      dto,
    );

    return {
      config: {
        cash_usd_rate_type: config.cash_usd_rate_type,
        cash_bs_rate_type: config.cash_bs_rate_type,
        pago_movil_rate_type: config.pago_movil_rate_type,
        transfer_rate_type: config.transfer_rate_type,
        point_of_sale_rate_type: config.point_of_sale_rate_type,
        zelle_rate_type: config.zelle_rate_type,
        rounding_mode: config.rounding_mode,
        rounding_precision: config.rounding_precision,
        prefer_change_in: config.prefer_change_in,
        auto_convert_small_change: config.auto_convert_small_change,
        small_change_threshold_usd: Number(config.small_change_threshold_usd),
        allow_overpayment: config.allow_overpayment,
        max_overpayment_usd: Number(config.max_overpayment_usd),
        overpayment_action: config.overpayment_action,
      },
      updated: true,
    };
  }

  // ============================================
  // ENDPOINTS ORIGINALES (COMPATIBILIDAD)
  // ============================================

  /**
   * Obtiene la tasa BCV actual
   */
  @Get('bcv')
  async getBCVRate(@Query('force') force?: string, @Request() req?: any) {
    try {
      const storeId = req?.user?.store_id;

      const rate = await this.exchangeService.getBCVRate(storeId);

      if (rate) {
        return {
          rate: rate.rate,
          source: rate.source,
          timestamp: rate.timestamp,
          available: true,
        };
      }

      return {
        rate: null,
        source: null,
        timestamp: null,
        available: false,
        message: 'Tasa BCV no disponible automáticamente. Ingrese manualmente.',
      };
    } catch (error) {
      this.logger.error(
        'Error en getBCVRate',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        rate: null,
        source: null,
        timestamp: null,
        available: false,
        message: 'Error al obtener la tasa de cambio.',
      };
    }
  }

  /**
   * Obtiene la tasa actual con fallback garantizado
   */
  @Get('bcv/current')
  async getCurrentRate(
    @Query('fallback') fallback?: string,
    @Request() req?: any,
  ) {
    try {
      const storeId = req?.user?.store_id;
      const fallbackRate = fallback ? parseFloat(fallback) : 36;
      const rate = await this.exchangeService.getCurrentRate(
        storeId,
        fallbackRate,
      );

      return {
        rate,
        available: true,
      };
    } catch (error) {
      this.logger.error(
        'Error en getCurrentRate',
        error instanceof Error ? error.stack : String(error),
      );
      const fallbackRate = fallback ? parseFloat(fallback) : 36;
      return {
        rate: fallbackRate,
        available: true,
      };
    }
  }

  /**
   * Establece una tasa manual
   */
  @Post('bcv/manual')
  async setManualRate(@Body() dto: SetManualRateDto, @Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;

    const effectiveFrom = dto.effective_from
      ? new Date(dto.effective_from)
      : undefined;
    const effectiveUntil = dto.effective_until
      ? new Date(dto.effective_until)
      : undefined;

    const exchangeRate = await this.exchangeService.setManualRate(
      storeId,
      dto.rate,
      userId,
      effectiveFrom,
      effectiveUntil,
      dto.note,
      dto.rate_type || 'BCV',
      dto.is_preferred ?? true,
    );

    return {
      id: exchangeRate.id,
      rate: Number(exchangeRate.rate),
      rate_type: exchangeRate.rate_type,
      is_preferred: exchangeRate.is_preferred,
      source: exchangeRate.source,
      effective_from: exchangeRate.effective_from,
      effective_until: exchangeRate.effective_until,
      created_at: exchangeRate.created_at,
    };
  }

  /**
   * Obtiene el historial de tasas
   */
  @Get('bcv/history')
  async getRateHistory(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('rate_type') rateType?: string,
    @Request() req?: any,
  ) {
    const storeId = req?.user?.store_id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const typeFilter = rateType
      ? (rateType.toUpperCase() as ExchangeRateType)
      : undefined;

    const result = await this.exchangeService.getRateHistory(
      storeId,
      limitNum,
      offsetNum,
      typeFilter,
    );

    return {
      rates: result.rates.map((rate) => ({
        id: rate.id,
        rate: Number(rate.rate),
        rate_type: rate.rate_type,
        is_preferred: rate.is_preferred,
        source: rate.source,
        effective_from: rate.effective_from,
        effective_until: rate.effective_until,
        is_active: rate.is_active,
        note: rate.note,
        created_at: rate.created_at,
      })),
      total: result.total,
    };
  }
}
