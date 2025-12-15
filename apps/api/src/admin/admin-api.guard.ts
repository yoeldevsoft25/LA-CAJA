import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const headerKey = req.headers['x-admin-key'] as string | undefined;
    const queryKey = req.query?.admin_key as string | undefined;
    const provided = headerKey || queryKey;
    const expected = process.env.ADMIN_SECRET;

    if (!expected) {
      throw new ForbiddenException('Admin no configurado (falta ADMIN_SECRET)');
    }

    if (!provided || provided !== expected) {
      throw new ForbiddenException('No autorizado (admin)');
    }

    return true;
  }
}
