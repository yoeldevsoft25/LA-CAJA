import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Validador de secrets para asegurar que cumplen requisitos de seguridad
 */
export class SecretValidator {
  private static readonly logger = new Logger(SecretValidator.name);

  /**
   * Valida que JWT_SECRET cumpla requisitos de seguridad
   */
  static validateJwtSecret(secret: string | undefined): void {
    if (!secret) {
      throw new Error(
        'JWT_SECRET debe estar configurado en las variables de entorno',
      );
    }

    if (secret.length < 32) {
      throw new Error(
        `JWT_SECRET debe tener al menos 32 caracteres. Actual: ${secret.length}`,
      );
    }

    // Verificar que no sea el valor por defecto
    if (
      secret.includes('default-secret') ||
      secret.includes('change-in-production')
    ) {
      throw new Error(
        'JWT_SECRET no puede contener valores por defecto. Debe ser único y seguro.',
      );
    }

    this.logger.log('✅ JWT_SECRET validado correctamente');
  }

  /**
   * Valida que ADMIN_SECRET cumpla requisitos de seguridad
   */
  static validateAdminSecret(secret: string | undefined): void {
    if (!secret) {
      this.logger.warn(
        '⚠️ ADMIN_SECRET no configurado. Endpoints admin deshabilitados.',
      );
      return;
    }

    if (secret.length < 16) {
      throw new Error(
        `ADMIN_SECRET debe tener al menos 16 caracteres. Actual: ${secret.length}`,
      );
    }

    this.logger.log('✅ ADMIN_SECRET validado correctamente');
  }

  /**
   * Valida todos los secrets requeridos
   */
  static validateAllSecrets(configService: ConfigService): void {
    this.validateJwtSecret(configService.get<string>('JWT_SECRET'));
    this.validateAdminSecret(configService.get<string>('ADMIN_SECRET'));
  }
}
