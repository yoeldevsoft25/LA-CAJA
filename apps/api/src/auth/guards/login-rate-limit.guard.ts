import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SecurityAuditService } from '../../security/security-audit.service';

/**
 * Guard mejorado de rate limiting para login
 * Implementa bloqueo progresivo basado en intentos fallidos
 * Se usa en combinación con @Throttle decorator
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(LoginRateLimitGuard.name);
  private readonly MAX_FAILED_ATTEMPTS = 10;
  private readonly BLOCK_DURATION_MINUTES = 15;

  constructor(private readonly securityAudit: SecurityAuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || 'unknown';

    // Verificar intentos fallidos recientes
    const failedAttempts = await this.securityAudit.getFailedLoginAttempts(
      ipAddress,
      this.BLOCK_DURATION_MINUTES,
    );

    // Bloqueo progresivo: bloquear después de N intentos fallidos
    if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      // Registrar bloqueo
      await this.securityAudit.log({
        event_type: 'login_blocked',
        ip_address: ipAddress,
        user_agent: request.headers['user-agent'] || 'unknown',
        request_path: request.url,
        request_method: request.method,
        status: 'blocked',
        details: {
          reason: 'Too many failed attempts',
          failedAttempts,
          blockDurationMinutes: this.BLOCK_DURATION_MINUTES,
        },
      });

      this.logger.warn(
        `IP ${ipAddress} bloqueada por ${failedAttempts} intentos fallidos`,
      );

      throw new HttpException(
        {
          message: `Demasiados intentos fallidos. Intenta nuevamente en ${this.BLOCK_DURATION_MINUTES} minutos.`,
          retryAfter: this.BLOCK_DURATION_MINUTES * 60, // En segundos
          failedAttempts,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Si hay intentos fallidos pero no alcanzó el límite, permitir pero con advertencia
    if (failedAttempts >= 5) {
      this.logger.warn(
        `IP ${ipAddress} tiene ${failedAttempts} intentos fallidos recientes`,
      );
    }

    // Permitir continuar (el @Throttle decorator aplicará rate limiting normal)
    return true;
  }
}

