import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { LicenseService } from './license-core.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicensePaymentsService } from './license-payments.service';
import { LicenseVerificationService } from './license-verification.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { LicensePaymentStatus } from '../database/entities/license-payment.entity';

@Controller('licenses')
export class LicensesController {
  private readonly logger = new Logger(LicensesController.name);

  constructor(
    private readonly paymentsService: LicensePaymentsService,
    private readonly verificationService: LicenseVerificationService,
    private readonly licenseService: LicenseService,
  ) { }

  /**
   * GET /licenses/status
   * Obtener el estado actual de la licencia y el token offline
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Request() req: any) {
    const storeId = req.user.store_id;
    const status = await this.licenseService.getLicenseStatus(storeId);
    const token = await this.licenseService.issueOfflineToken(storeId);

    return {
      ...status,
      token,
    };
  }

  // ============================================
  // ENDPOINTS PÚBLICOS (requieren autenticación JWT)
  // ============================================

  /**
   * GET /licenses/plans
   * Obtener planes y precios disponibles
   */
  @Get('plans')
  @UseGuards(JwtAuthGuard)
  getPlans() {
    return this.paymentsService.getPlans();
  }

  /**
   * POST /licenses/payments
   * Crear una nueva solicitud de pago
   */
  @Post('payments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPaymentRequest(
    @Body() dto: CreatePaymentRequestDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.sub; // ID del usuario autenticado

    if (!storeId) {
      throw new BadRequestException('store_id no encontrado en el token');
    }

    return this.paymentsService.createPaymentRequest(storeId, userId, dto);
  }

  /**
   * GET /licenses/payments/:id
   * Obtener estado de una solicitud de pago propia
   */
  @Get('payments/:id')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('id') id: string, @Request() req: any) {
    const storeId = req.user.store_id;
    return this.paymentsService.getPaymentById(id, storeId);
  }

  /**
   * GET /licenses/payments
   * Listar solicitudes de pago propias del usuario
   */
  @Get('payments')
  @UseGuards(JwtAuthGuard)
  async listMyPayments(
    @Request() req: any,
    @Query('status') status?: LicensePaymentStatus,
  ) {
    const storeId = req.user.store_id;
    return this.paymentsService.listPayments(storeId, status, 50, 0);
  }


}
