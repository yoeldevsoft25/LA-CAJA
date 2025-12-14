import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-change-in-production',
    });
  }

  async validate(payload: any) {
    // Validar que el usuario existe en la tienda
    const member = await this.authService.validateUser(payload.sub, payload.store_id);
    if (!member) {
      throw new UnauthorizedException('Usuario no autorizado para esta tienda');
    }

    return {
      sub: payload.sub,
      store_id: payload.store_id,
      role: payload.role,
    };
  }
}

