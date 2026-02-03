import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SetupService, SetupConfig } from './setup.service';

@Controller('setup')
@UseGuards(JwtAuthGuard)
@Roles('owner')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  /**
   * Ejecutar setup automático completo para la tienda
   */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runSetup(@Request() req: any, @Body() config: SetupConfig) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return this.setupService.setupStore(storeId, userId, config);
  }

  /**
   * Validar estado de configuración de la tienda
   */
  @Get('validate')
  async validateSetup(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.setupService.validateSetup(storeId);
  }
}
