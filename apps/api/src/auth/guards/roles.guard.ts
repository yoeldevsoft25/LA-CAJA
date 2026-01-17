import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
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
    
    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Este endpoint requiere uno de los siguientes roles: ${requiredRoles.join(', ')}. Tu rol actual es: ${userRole}`,
      );
    }
    
    return true;
  }
}
