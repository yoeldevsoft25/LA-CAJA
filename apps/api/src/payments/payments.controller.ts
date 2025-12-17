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
import { PaymentMethodConfigsService } from './payment-method-configs.service';
import { CashMovementsService } from './cash-movements.service';
import { PaymentRulesService } from './payment-rules.service';
import { CreatePaymentMethodConfigDto } from './dto/create-payment-method-config.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestión de métodos de pago y movimientos de efectivo
 */
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly configsService: PaymentMethodConfigsService,
    private readonly movementsService: CashMovementsService,
    private readonly rulesService: PaymentRulesService,
  ) {}

  // ============================================
  // CONFIGURACIÓN DE MÉTODOS DE PAGO
  // ============================================

  /**
   * Crea o actualiza configuración de método de pago
   */
  @Put('methods/:method')
  async upsertPaymentMethodConfig(
    @Param('method') method: string,
    @Body() dto: CreatePaymentMethodConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    dto.method = method as any;
    return this.configsService.upsertConfig(storeId, dto);
  }

  /**
   * Obtiene todas las configuraciones de métodos de pago
   */
  @Get('methods')
  async getPaymentMethodConfigs(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.configsService.getConfigs(storeId);
  }

  /**
   * Obtiene configuración de un método específico
   */
  @Get('methods/:method')
  async getPaymentMethodConfig(
    @Param('method') method: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.configsService.getConfig(storeId, method);
  }

  /**
   * Elimina configuración de método de pago
   */
  @Delete('methods/:method')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePaymentMethodConfig(
    @Param('method') method: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    await this.configsService.deleteConfig(storeId, method);
  }

  // ============================================
  // MOVIMIENTOS DE EFECTIVO
  // ============================================

  /**
   * Registra un movimiento de efectivo (entrada o salida)
   */
  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  async createCashMovement(
    @Body() dto: CreateCashMovementDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub;
    return this.movementsService.createMovement(storeId, userId, dto);
  }

  /**
   * Obtiene los movimientos de efectivo
   */
  @Get('movements')
  async getCashMovements(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Query('shift_id') shiftId: string,
    @Query('cash_session_id') cashSessionId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.movementsService.getMovements(
      storeId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
      shiftId,
      cashSessionId,
    );
  }

  /**
   * Obtiene resumen de movimientos de efectivo
   */
  @Get('movements/summary')
  async getCashMovementsSummary(
    @Query('shift_id') shiftId: string,
    @Query('cash_session_id') cashSessionId: string,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.movementsService.getMovementsSummary(
      storeId,
      shiftId,
      cashSessionId,
    );
  }
}
