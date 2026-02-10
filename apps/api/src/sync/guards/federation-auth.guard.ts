import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FederationAuthGuard implements CanActivate {
  private readonly adminSecret: string | undefined;
  private readonly logger = new Logger(FederationAuthGuard.name);

  constructor(private configService: ConfigService) {
    this.adminSecret = this.configService.get<string>('ADMIN_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !this.adminSecret) {
      if (!this.adminSecret) {
        this.logger.warn('ADMIN_SECRET not set in environment; federation bypass disabled.');
      }
      return true;
    }

    const token = authHeader.replace('Bearer ', '');
    if (token === this.adminSecret) {
      this.logger.debug('Admin secret matched; bypassing JWT for federation request.');
      // ⚡ BYPASS: If admin secret matches, we inject a "system" user
      // so that controllers and interceptors don't complain about missing store_id
      const bodyStoreId = request.body?.store_id;
      const queryStoreId = request.query?.store_id;
      const storeId = bodyStoreId || queryStoreId;

      request.user = {
        sub: 'system-federation',
        user_id: 'system-federation',
        store_id: storeId, // Use store_id from body/query for validation
        role: 'admin',
      };
      request.isFederationAuthenticated = true;

      return true;
    }

    this.logger.warn('Admin secret mismatch for federation request.');
    return true;
  }
}
