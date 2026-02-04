import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FederationAuthGuard implements CanActivate {
    private readonly adminSecret: string | undefined;

    constructor(private configService: ConfigService) {
        this.adminSecret = this.configService.get<string>('ADMIN_SECRET');
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader || !this.adminSecret) {
            return false; // Leave it for the next guard (JwtAuthGuard)
        }

        const token = authHeader.replace('Bearer ', '');
        if (token === this.adminSecret) {
            // ⚡ BYPASS: If admin secret matches, we inject a "system" user
            // so that controllers and interceptors don't complain about missing store_id
            const bodyStoreId = request.body?.store_id;

            request.user = {
                sub: 'system-federation',
                user_id: 'system-federation',
                store_id: bodyStoreId, // Use the store_id provided in the body for validation
                role: 'admin',
            };

            return true;
        }

        return false;
    }
}
