import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard para autenticación de auditoría del SENIAT
 *
 * Valida que las solicitudes de auditoría incluyan la clave correcta
 * en el header 'x-seniat-audit-key'.
 */
@Injectable()
export class SeniatAuditGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auditKey = request.headers['x-seniat-audit-key'];

    const expectedKey = this.configService.get<string>('SENIAT_AUDIT_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException(
        'Endpoint de auditoría no configurado. Configure SENIAT_AUDIT_KEY.',
      );
    }

    if (!auditKey || auditKey !== expectedKey) {
      throw new UnauthorizedException('Clave de auditoría inválida');
    }

    return true;
  }
}










