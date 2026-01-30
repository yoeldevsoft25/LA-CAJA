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
    DefaultValuePipe,
    ParseIntPipe,
} from '@nestjs/common';
import { AdminApiGuard } from '../admin/admin-api.guard';
import { LicensePaymentsService } from './license-payments.service';
import { LicenseVerificationService } from './license-verification.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { ApprovePaymentDto, RejectPaymentDto } from './dto/approve-payment.dto';
import { LicensePaymentStatus } from '../database/entities/license-payment.entity';

@Controller('admin/license-payments')
@UseGuards(AdminApiGuard)
export class AdminLicensePaymentsController {
    constructor(
        private readonly paymentsService: LicensePaymentsService,
        private readonly verificationService: LicenseVerificationService,
    ) { }

    /**
     * GET /admin/license-payments
     * Listar todas las solicitudes de pago (con filtros)
     */
    @Get()
    async listLicensePayments(
        @Query('store_id') storeId?: string,
        @Query('status') status?: LicensePaymentStatus,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
    ) {
        return this.paymentsService.listPayments(storeId, status, limit, offset);
    }

    /**
     * GET /admin/license-payments/stats
     * Obtener estadísticas de pagos
     */
    @Get('stats')
    async getPaymentStats(@Query('store_id') storeId?: string) {
        return this.paymentsService.getPaymentStats(storeId);
    }

    /**
     * GET /admin/license-payments/:id
     * Obtener detalles de una solicitud de pago
     */
    @Get(':id')
    async getPaymentDetails(@Param('id') id: string) {
        return this.paymentsService.getPaymentById(id);
    }

    /**
     * POST /admin/license-payments/:id/verify
     * Verificar un pago (manual o automático)
     */
    @Post(':id/verify')
    @HttpCode(HttpStatus.OK)
    async verifyPayment(
        @Param('id') id: string,
        @Body() dto: VerifyPaymentDto,
        @Request() req: any,
    ) {
        const verifiedBy = req.headers['x-admin-user-id'] || 'system';
        return this.verificationService.verifyPayment(id, verifiedBy, dto);
    }

    /**
     * POST /admin/license-payments/:id/approve
     * Aprobar un pago y activar la licencia
     */
    @Post(':id/approve')
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
    @Post(':id/reject')
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
     * POST /admin/license-payments/:id/retry-verification
     * Reintentar verificación automática
     */
    @Post(':id/retry-verification')
    @HttpCode(HttpStatus.OK)
    async retryVerification(@Param('id') id: string) {
        return this.verificationService.retryAutomaticVerification(id);
    }
}
