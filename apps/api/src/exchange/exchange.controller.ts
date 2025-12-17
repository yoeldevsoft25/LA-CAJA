import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Body,
  Request,
} from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetManualRateDto } from './dto/set-manual-rate.dto';

@Controller('exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  /**
   * Obtiene la tasa BCV actual
   * Prioriza: tasa manual activa > API > última tasa manual > fallback
   */
  @Get('bcv')
  async getBCVRate(@Query('force') force?: string, @Request() req?: any) {
    const storeId = req?.user?.store_id;

    // Si force=true, ignorar cache
    if (force === 'true') {
      // Limpiar cache forzando nueva búsqueda
      const rate = await this.exchangeService.getBCVRate(storeId);
      return {
        rate: rate?.rate || null,
        source: rate?.source || null,
        timestamp: rate?.timestamp || null,
        available: rate !== null,
      };
    }

    // Intentar obtener tasa automáticamente
    const rate = await this.exchangeService.getBCVRate(storeId);

    if (rate) {
      return {
        rate: rate.rate,
        source: rate.source,
        timestamp: rate.timestamp,
        available: true,
      };
    }

    // Si no está disponible automáticamente, retornar null
    // El frontend deberá solicitar entrada manual
    return {
      rate: null,
      source: null,
      timestamp: null,
      available: false,
      message: 'Tasa BCV no disponible automáticamente. Ingrese manualmente.',
    };
  }

  /**
   * Obtiene la tasa actual con fallback garantizado
   */
  @Get('bcv/current')
  async getCurrentRate(
    @Query('fallback') fallback?: string,
    @Request() req?: any,
  ) {
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
    );

    return {
      id: exchangeRate.id,
      rate: Number(exchangeRate.rate),
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
    @Request() req?: any,
  ) {
    const storeId = req?.user?.store_id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const result = await this.exchangeService.getRateHistory(
      storeId,
      limitNum,
      offsetNum,
    );

    return {
      rates: result.rates.map((rate) => ({
        id: rate.id,
        rate: Number(rate.rate),
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
