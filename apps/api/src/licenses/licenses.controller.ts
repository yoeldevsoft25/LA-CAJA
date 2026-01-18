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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminApiGuard } from '../admin/admin-api.guard';
import { LicensePaymentsService } from './license-payments.service';
import { LicenseVerificationService } from './license-verification.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  ApprovePaymentDto,
  RejectPaymentDto,
} from './dto/approve-payment.dto';
import { LicensePaymentStatus } from '../database/entities/license-payment.entity';

@Controller('licenses')
export class LicensesController {
  private readonly logger = new Logger(LicensesController.name);

  constructor(
    private readonly paymentsService: LicensePaymentsService,
    private readonly verificationService: LicenseVerificationService,
  ) {}

  // ============================================
  // ENDPOINTS PÚBLICOS (requieren autenticación JWT)
  // ============================================

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

  // ============================================
  // ENDPOINTS ADMIN (requieren AdminApiGuard)
  // ============================================

  /**
   * GET /admin/license-payments
   * Listar todas las solicitudes de pago (con filtros)
   */
  @Get('admin/license-payments')
  @UseGuards(AdminApiGuard)
  async listLicensePayments(
    @Query('store_id') storeId?: string,
    @Query('status') status?: LicensePaymentStatus,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
  ) {
    return this.paymentsService.listPayments(storeId, status, limit, offset);
  }

  /**
   * GET /admin/license-payments/:id
   * Obtener detalles de una solicitud de pago
   */
  @Get('admin/license-payments/:id')
  @UseGuards(AdminApiGuard)
  async getPaymentDetails(@Param('id') id: string) {
    return this.paymentsService.getPaymentById(id);
  }

  /**
   * POST /admin/license-payments/:id/verify
   * Verificar un pago (manual o automático)
   */
  @Post('admin/license-payments/:id/verify')
  @UseGuards(AdminApiGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
    @Request() req: any,
  ) {
    // En producción, obtener el admin ID del sistema de autenticación
    // Por ahora, usamos un valor por defecto o del header
    const verifiedBy = req.headers['x-admin-user-id'] || 'system';

    return this.verificationService.verifyPayment(id, verifiedBy, dto);
  }

  /**
   * POST /admin/license-payments/:id/approve
   * Aprobar un pago y activar la licencia
   */
  @Post('admin/license-payments/:id/approve')
  @UseGuards(AdminApiGuard)
  @HttpCode(HttpStatus.OK)
  async approvePayment(
    @Param('id') id: string,
    @Body() dto: ApprovePaymentDto,
    @Request() req: any,
  ) {
    const approvedBy = req.headers['x-admin-user-id'] || 'system';

    return this.paymentsService.approvePayment(id, approvedBy, dto.notes);
  }

  /**
   * POST /admin/license-payments/:id/reject
   * Rechazar un pago
   */
  @Post('admin/license-payments/:id/reject')
  @UseGuards(AdminApiGuard)
  @HttpCode(HttpStatus.OK)
  async rejectPayment(
    @Param('id') id: string,
    @Body() dto: RejectPaymentDto,
    @Request() req: any,
  ) {
    const rejectedBy = req.headers['x-admin-user-id'] || 'system';

    return this.paymentsService.rejectPayment(
      id,
      rejectedBy,
      dto.rejection_reason,
      dto.notes,
    );
  }

  /**
   * GET /admin/license-payments/stats
   * Obtener estadísticas de pagos
   */
  @Get('admin/license-payments/stats')
  @UseGuards(AdminApiGuard)
  async getPaymentStats(@Query('store_id') storeId?: string) {
    return this.paymentsService.getPaymentStats(storeId);
  }

  /**
   * POST /admin/license-payments/:id/retry-verification
   * Reintentar verificación automática
   */
  @Post('admin/license-payments/:id/retry-verification')
  @UseGuards(AdminApiGuard)
  @HttpCode(HttpStatus.OK)
  async retryVerification(@Param('id') id: string) {
    return this.verificationService.retryAutomaticVerification(id);
  }
}
