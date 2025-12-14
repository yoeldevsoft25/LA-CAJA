import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get('bcv')
  async getBCVRate(@Query('force') force?: string) {
    // Si force=true, ignorar cache
    if (force === 'true') {
      // Limpiar cache forzando nueva búsqueda
      const rate = await this.exchangeService.getBCVRate();
      return {
        rate: rate?.rate || null,
        source: rate?.source || null,
        timestamp: rate?.timestamp || null,
        available: rate !== null,
      };
    }

    // Intentar obtener tasa automáticamente
    const rate = await this.exchangeService.getBCVRate();

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
}

