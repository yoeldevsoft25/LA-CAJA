import {
  ForbiddenException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import { Store } from '../../database/entities/store.entity';

@Injectable()
export class LicenseInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    // Si no hay usuario autenticado, no validamos licencia aquí
    // El usuario 'system-federation' también se ignora para permitir sincronización entre nodos
    if (!user || !user.store_id || user.sub === 'system-federation') {
      return next.handle();
    }

    const repo = this.dataSource.getRepository(Store);
    const store = await repo.findOne({ where: { id: user.store_id } });
    if (!store) {
      throw new ForbiddenException('Tienda no encontrada o no autorizada');
    }

    const status = store.license_status;
    const expires = store.license_expires_at
      ? store.license_expires_at.getTime()
      : null;
    const grace = store.license_grace_days ?? 0;
    const now = Date.now();

    if (!status) {
      throw new ForbiddenException({
        code: 'LICENSE_BLOCKED',
        message: 'Licencia no configurada',
      });
    }

    if (status === 'suspended') {
      throw new ForbiddenException({
        code: 'LICENSE_BLOCKED',
        message: 'Licencia suspendida',
      });
    }

    if (!expires) {
      throw new ForbiddenException({
        code: 'LICENSE_BLOCKED',
        message: 'Licencia no configurada o sin fecha de expiración',
      });
    }

    const graceMs = grace * 24 * 60 * 60 * 1000;
    if (now > expires + graceMs) {
      throw new ForbiddenException({
        code: 'LICENSE_BLOCKED',
        message: 'Licencia expirada',
      });
    }

    return next.handle();
  }
}
