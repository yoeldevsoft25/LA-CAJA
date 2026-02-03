import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SecurityAuditService } from '../security/security-audit.service';

/**
 * Guard para proteger endpoints administrativos
 * ✅ SEGURIDAD: Solo acepta secretos en headers, NO en query params
 */
@Injectable()
export class AdminApiGuard implements CanActivate {
  private readonly logger = new Logger(AdminApiGuard.name);

  constructor(private readonly securityAudit: SecurityAuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // ✅ SOLO headers, NO query params (seguridad OWASP A01)
    const headerKey = req.headers['x-admin-key'] as string | undefined;
    const expected = process.env.ADMIN_SECRET;

    if (!expected) {
      throw new ForbiddenException('Admin no configurado (falta ADMIN_SECRET)');
    }

    if (!headerKey || headerKey !== expected) {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

      // ✅ Registrar intento no autorizado (no esperar para no bloquear)
      this.securityAudit
        .log({
          event_type: 'unauthorized_access',
          ip_address: ipAddress,
          user_agent: req.headers['user-agent'] || 'unknown',
          request_path: req.url,
          request_method: req.method,
          status: 'blocked',
          details: {
            reason: 'Invalid admin key',
          },
        })
        .catch((err) => {
          // No fallar si el logging falla
          this.logger.error('Error registrando audit log', err);
        });

      this.logger.warn(
        `Intento de acceso admin no autorizado desde ${ipAddress}`,
      );
      throw new ForbiddenException('No autorizado (admin)');
    }

    return true;
  }
}
