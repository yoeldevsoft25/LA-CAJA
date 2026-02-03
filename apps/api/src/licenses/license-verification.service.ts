import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  LicensePayment,
  LicensePaymentStatus,
} from '../database/entities/license-payment.entity';
import {
  LicensePaymentVerification,
  VerificationMethod,
  VerificationStatus,
} from '../database/entities/license-payment-verification.entity';
import { LicenseBankIntegrationService } from './license-bank-integration.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class LicenseVerificationService {
  private readonly logger = new Logger(LicenseVerificationService.name);

  constructor(
    @InjectRepository(LicensePayment)
    private readonly paymentRepo: Repository<LicensePayment>,
    @InjectRepository(LicensePaymentVerification)
    private readonly verificationRepo: Repository<LicensePaymentVerification>,
    private readonly bankIntegration: LicenseBankIntegrationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verifica un pago (manual o automático)
   */
  async verifyPayment(
    paymentId: string,
    verifiedBy: string,
    dto: VerifyPaymentDto,
  ): Promise<LicensePayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Pago no encontrado');
    }

    if (payment.status === LicensePaymentStatus.VERIFIED) {
      throw new BadRequestException('El pago ya está verificado');
    }

    if (payment.status === LicensePaymentStatus.APPROVED) {
      throw new BadRequestException('El pago ya está aprobado');
    }

    if (payment.status === LicensePaymentStatus.REJECTED) {
      throw new BadRequestException('El pago fue rechazado');
    }

    // Determinar método de verificación
    let verificationMethod = VerificationMethod.MANUAL;
    let verificationResult: {
      result: {
        success: boolean;
        status: VerificationStatus;
        responseData?: any;
        errorMessage?: string;
      };
      method: VerificationMethod;
    } | null = null;

    // Si se solicita verificación automática, intentar
    if (dto.auto_verify && this.bankIntegration.hasBankIntegration()) {
      payment.status = LicensePaymentStatus.VERIFYING;
      await this.paymentRepo.save(payment);

      try {
        verificationResult =
          await this.bankIntegration.verifyAutomatic(payment);
        verificationMethod = verificationResult.method;

        // Registrar el intento de verificación
        const verification = this.verificationRepo.create({
          payment_id: paymentId,
          verification_method: verificationMethod,
          status: verificationResult.result.status,
          response_data: verificationResult.result.responseData || null,
          error_message: verificationResult.result.errorMessage || null,
          verified_at: verificationResult.result.success ? new Date() : null,
        });
        await this.verificationRepo.save(verification);

        // Si la verificación automática fue exitosa, marcar como verificado
        if (verificationResult.result.success) {
          payment.status = LicensePaymentStatus.VERIFIED;
          payment.verified_at = new Date();
          payment.verified_by = verifiedBy;
          payment.auto_verified = true;
          payment.verification_attempts += 1;

          if (dto.notes) {
            payment.notes = dto.notes;
          }

          await this.paymentRepo.save(payment);
          this.logger.log(
            `Pago ${paymentId} verificado automáticamente mediante ${verificationMethod}`,
          );

          return payment;
        } else {
          // La verificación automática falló, requiere revisión manual
          payment.status = LicensePaymentStatus.PENDING;
          payment.verification_attempts += 1;
          await this.paymentRepo.save(payment);

          this.logger.warn(
            `Verificación automática falló para pago ${paymentId}: ${verificationResult.result.errorMessage}`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Error en verificación automática: ${error.message}`,
          error.stack,
        );
        payment.status = LicensePaymentStatus.PENDING;
        await this.paymentRepo.save(payment);
      }
    }

    // Si no se solicitó verificación automática o falló, marcar como verificado manualmente
    if (!dto.auto_verify || !verificationResult?.result.success) {
      if (dto.method) {
        verificationMethod = dto.method;
      }

      // Si es manual, requiere confirmación explícita
      payment.status = LicensePaymentStatus.VERIFIED;
      payment.verified_at = new Date();
      payment.verified_by = verifiedBy;
      payment.auto_verified = false;
      payment.verification_attempts += 1;

      if (dto.notes) {
        payment.notes = dto.notes;
      }

      // Registrar verificación manual
      const verification = this.verificationRepo.create({
        payment_id: paymentId,
        verification_method: verificationMethod,
        status: VerificationStatus.SUCCESS,
        verified_at: new Date(),
      });
      await this.verificationRepo.save(verification);

      await this.paymentRepo.save(payment);
      this.logger.log(
        `Pago ${paymentId} verificado manualmente por ${verifiedBy}`,
      );
    }

    return payment;
  }

  /**
   * Retry de verificación automática
   */
  async retryAutomaticVerification(paymentId: string): Promise<LicensePayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Pago no encontrado');
    }

    const maxRetries =
      this.configService.get<number>('LICENSE_AUTO_VERIFY_RETRIES') || 3;

    if (payment.verification_attempts >= maxRetries) {
      throw new BadRequestException(
        `Se alcanzó el máximo de intentos (${maxRetries})`,
      );
    }

    // Intentar verificación automática
    const verificationResult =
      await this.bankIntegration.verifyAutomatic(payment);

    // Registrar el intento
    const verification = this.verificationRepo.create({
      payment_id: paymentId,
      verification_method: verificationResult.method,
      status: verificationResult.result.status,
      response_data: verificationResult.result.responseData || null,
      error_message: verificationResult.result.errorMessage || null,
      verified_at: verificationResult.result.success ? new Date() : null,
    });
    await this.verificationRepo.save(verification);

    if (verificationResult.result.success) {
      payment.status = LicensePaymentStatus.VERIFIED;
      payment.verified_at = new Date();
      payment.auto_verified = true;
    }

    payment.verification_attempts += 1;
    await this.paymentRepo.save(payment);

    return payment;
  }
}
