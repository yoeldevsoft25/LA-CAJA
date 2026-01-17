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
    console.log('[JwtStrategy] Validando token:', {
      userId: payload.sub,
      storeId: payload.store_id,
      roleInToken: payload.role,
      fullPayload: payload,
    });
    
    // Validar que el usuario existe en la tienda
    const member = await this.authService.validateUser(
      payload.sub,
      payload.store_id,
    );
    if (!member) {
      throw new UnauthorizedException('Usuario no autorizado para esta tienda');
    }

    console.log('[JwtStrategy] Usuario validado:', {
      userId: payload.sub,
      storeId: payload.store_id,
      roleInToken: payload.role,
      roleInDB: member.role,
      rolesMatch: payload.role === member.role,
      fullMember: member,
    });

    // ⚠️ IMPORTANTE: Usar el rol de la base de datos (member.role), NO el del token
    // Esto asegura que si el rol del usuario cambió en la DB, se use el rol actual
    // El token puede tener un rol desactualizado si el usuario cambió de rol después del login
    if (payload.role !== member.role) {
      console.warn('[JwtStrategy] ⚠️ Discrepancia de rol detectada:', {
        userId: payload.sub,
        storeId: payload.store_id,
        roleInToken: payload.role,
        roleInDB: member.role,
        action: 'Usando rol de la base de datos',
      });
    }

    return {
      sub: payload.sub,
      store_id: payload.store_id,
      role: member.role, // Usar rol de la base de datos (actualizado)
    };
  }
}
