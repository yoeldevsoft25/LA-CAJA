import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ConfigValidationService } from './config-validation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de validación de configuración del sistema
 */
@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(
    private readonly configValidationService: ConfigValidationService,
  ) {}

  /**
   * GET /config/status
   * Obtiene el estado de la configuración del sistema
   */
  @Get('status')
  async getConfigurationStatus(@Request() req: any) {
    const storeId = req.user.store_id;
    const status =
      await this.configValidationService.validateSystemConfiguration(storeId);

    return {
      success: true,
      status,
    };
  }

  /**
   * GET /config/can-generate-sale
   * Verifica si se puede generar una venta
   */
  @Get('can-generate-sale')
  async canGenerateSale(@Request() req: any) {
    const storeId = req.user.store_id;
    const canGenerate = await this.configValidationService.canGenerateSale(
      storeId,
    );
    const errorMessage = canGenerate
      ? null
      : await this.configValidationService.getConfigurationErrorMessage(
          storeId,
        );

    return {
      success: true,
      canGenerateSale: canGenerate,
      errorMessage,
    };
  }
}
