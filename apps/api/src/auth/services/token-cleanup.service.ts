import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { EmailVerificationToken } from '../../database/entities/email-verification-token.entity';
import { PinRecoveryToken } from '../../database/entities/pin-recovery-token.entity';

/**
 * Servicio para limpiar tokens expirados automáticamente
 * Ejecuta limpieza periódica para mantener la base de datos optimizada
 */
@Injectable()
export class TokenCleanupService implements OnModuleInit {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationTokenRepository: Repository<EmailVerificationToken>,
    @InjectRepository(PinRecoveryToken)
    private pinRecoveryTokenRepository: Repository<PinRecoveryToken>,
  ) {}

  onModuleInit() {
    this.logger.log('TokenCleanupService inicializado');
    // Ejecutar limpieza inicial después de 1 minuto
    setTimeout(() => {
      this.cleanupExpiredTokens().catch((error) => {
        this.logger.error('Error en limpieza inicial de tokens:', error);
      });
    }, 60000);
  }

  /**
   * Limpia tokens expirados y revocados antiguos
   * Se ejecuta diariamente a las 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredTokens(): Promise<void> {
    this.logger.log('Iniciando limpieza de tokens expirados...');
    const now = new Date();

    try {
      // Limpiar refresh tokens expirados y revocados antiguos (más de 30 días)
      const refreshTokenCutoff = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000,
      );
      const deletedRefreshTokens = await this.refreshTokenRepository.delete({
        expires_at: LessThan(refreshTokenCutoff),
      });
      this.logger.log(
        `Eliminados ${deletedRefreshTokens.affected || 0} refresh tokens expirados`,
      );

      // Limpiar tokens de verificación de email expirados y usados (más de 7 días)
      const emailTokenCutoff = new Date(
        now.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      const deletedEmailTokens = await this.emailVerificationTokenRepository
        .createQueryBuilder()
        .delete()
        .where('expires_at < :cutoff', { cutoff: emailTokenCutoff })
        .orWhere('(used_at IS NOT NULL AND used_at < :cutoff)', {
          cutoff: emailTokenCutoff,
        })
        .execute();
      this.logger.log(
        `Eliminados ${deletedEmailTokens.affected || 0} tokens de verificación de email`,
      );

      // Limpiar tokens de recuperación de PIN expirados y usados (más de 7 días)
      const pinRecoveryCutoff = new Date(
        now.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      const deletedPinRecovery = await this.pinRecoveryTokenRepository
        .createQueryBuilder()
        .delete()
        .where('expires_at < :cutoff', { cutoff: pinRecoveryCutoff })
        .orWhere('(used_at IS NOT NULL AND used_at < :cutoff)', {
          cutoff: pinRecoveryCutoff,
        })
        .execute();
      this.logger.log(
        `Eliminados ${deletedPinRecovery.affected || 0} tokens de recuperación de PIN`,
      );

      const totalDeleted =
        (deletedRefreshTokens.affected || 0) +
        (deletedEmailTokens.affected || 0) +
        (deletedPinRecovery.affected || 0);

      this.logger.log(
        `Limpieza completada: ${totalDeleted} tokens eliminados en total`,
      );
    } catch (error) {
      this.logger.error('Error en limpieza de tokens:', error);
    }
  }
}
