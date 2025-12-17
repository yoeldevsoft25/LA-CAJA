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
import { PeripheralsService } from './peripherals.service';
import { CreatePeripheralConfigDto } from './dto/create-peripheral-config.dto';
import { UpdatePeripheralConfigDto } from './dto/update-peripheral-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PeripheralType } from '../database/entities/peripheral-config.entity';

/**
 * Controlador para gestión de periféricos
 */
@Controller('peripherals')
@UseGuards(JwtAuthGuard)
export class PeripheralsController {
  constructor(private readonly peripheralsService: PeripheralsService) {}

  /**
   * Crea una nueva configuración de periférico
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConfig(
    @Body() dto: CreatePeripheralConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.peripheralsService.createConfig(storeId, dto);
  }

  /**
   * Obtiene todas las configuraciones de periféricos
   */
  @Get()
  async getConfigsByStore(
    @Request() req: any,
    @Query('type') type?: PeripheralType,
  ) {
    const storeId = req.user.store_id;
    if (type) {
      return this.peripheralsService.getConfigsByType(storeId, type);
    }
    return this.peripheralsService.getConfigsByStore(storeId);
  }

  /**
   * Obtiene la configuración por defecto de un tipo
   */
  @Get('default/:type')
  async getDefaultConfig(
    @Param('type') type: PeripheralType,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.peripheralsService.getDefaultConfig(storeId, type);
  }

  /**
   * Obtiene una configuración por ID
   */
  @Get(':id')
  async getConfigById(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.peripheralsService.getConfigById(storeId, id);
  }

  /**
   * Actualiza una configuración de periférico
   */
  @Put(':id')
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdatePeripheralConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.peripheralsService.updateConfig(storeId, id, dto);
  }

  /**
   * Marca una configuración como por defecto
   */
  @Put(':id/set-default')
  async setAsDefault(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.peripheralsService.setAsDefault(storeId, id);
  }

  /**
   * Elimina una configuración de periférico
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    await this.peripheralsService.deleteConfig(storeId, id);
  }
}
