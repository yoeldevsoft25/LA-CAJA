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
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET debe estar configurado en las variables de entorno. ' +
          'En producción, esto es obligatorio por seguridad.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    // Validar que el usuario existe en la tienda
    const member = await this.authService.validateUser(
      payload.sub,
      payload.store_id,
    );
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
