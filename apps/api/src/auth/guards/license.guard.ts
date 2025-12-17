import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Store } from '../../database/entities/store.entity';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Rutas sin auth o sin store_id: dejar pasar (otros guards decidirán)
    if (!user || !user.store_id) {
      return true;
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
      throw new ForbiddenException('Licencia no configurada');
    }

    if (status === 'suspended') {
      throw new ForbiddenException('Licencia suspendida');
    }

    if (!expires) {
      throw new ForbiddenException(
        'Licencia no configurada o sin fecha de expiración',
      );
    }

    const graceMs = grace * 24 * 60 * 60 * 1000;
    if (now > expires + graceMs) {
      throw new ForbiddenException('Licencia expirada');
    }

    return true;
  }
}
