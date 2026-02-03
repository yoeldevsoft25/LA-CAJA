import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request?.user?.role || 'cashier';
    const userId = request?.user?.sub || 'unknown';
    const storeId = request?.user?.store_id || 'unknown';

    // Logging para depuración (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug('Validando acceso', {
        endpoint: `${request.method} ${request.path}`,
        userId,
        storeId,
        userRole,
        requiredRoles,
      });
    }

    if (!requiredRoles.includes(userRole)) {
      this.logger.warn('Acceso denegado', {
        endpoint: `${request.method} ${request.path}`,
        userId,
        storeId,
        userRole,
        requiredRoles,
      });
      throw new ForbiddenException(
        `Este endpoint requiere uno de los siguientes roles: ${requiredRoles.join(', ')}. Tu rol actual es: ${userRole}`,
      );
    }

    return true;
  }
}
