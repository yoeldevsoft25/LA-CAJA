import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from '../license-core.service';
import { UsageService } from '../usage.service';

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private licenseService: LicenseService,
    private usageService: UsageService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Si no hay usuario o store, el guard no tiene contexto para validar (otros guards fallarán si es necesario)
    if (!user || !user.store_id) {
      return true;
    }

    const storeId = user.store_id;

    // 1. Verificar Feature Requerida
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      'required_feature',
      [context.getHandler(), context.getClass()],
    );

    if (requiredFeature) {
      const hasFeature = await this.licenseService.checkFeature(
        storeId,
        requiredFeature,
      );
      if (!hasFeature) {
        throw new ForbiddenException({
          code: 'FEATURE_LOCKED',
          message: `Tu plan actual no incluye la funcionalidad: ${requiredFeature}`,
          feature: requiredFeature,
        });
      }
    }

    // 2. Verificar Quota Requerida (Solo si es una operación de creación POST/PUT)
    const requiredQuota = this.reflector.getAllAndOverride<string>(
      'required_quota',
      [context.getHandler(), context.getClass()],
    );

    if (requiredQuota && request.method === 'POST') {
      await this.usageService.checkQuota(storeId, requiredQuota);
    }

    return true;
  }
}
