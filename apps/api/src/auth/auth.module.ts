import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { TokenCleanupService } from './services/token-cleanup.service';
import { Store } from '../database/entities/store.entity';
import { Profile } from '../database/entities/profile.entity';
import { StoreMember } from '../database/entities/store-member.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { EmailVerificationToken } from '../database/entities/email-verification-token.entity';
import { PinRecoveryToken } from '../database/entities/pin-recovery-token.entity';
import { TwoFactorAuth } from '../database/entities/two-factor-auth.entity';
import { SecurityModule } from '../security/security.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LicensesModule } from '../licenses/licenses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      Profile,
      StoreMember,
      RefreshToken,
      EmailVerificationToken,
      PinRecoveryToken,
      TwoFactorAuth,
    ]),
    NotificationsModule,
    SecurityModule, // ✅ Módulo de seguridad para auditoría
    LicensesModule, // ✅ Control de licencias y cuotas
    ScheduleModule, // ✅ Para cron jobs de limpieza de tokens
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error(
            'JWT_SECRET debe estar configurado en las variables de entorno. ' +
              'En producción, esto es obligatorio por seguridad.',
          );
        }

        // Access tokens cortos (15 min) para mayor seguridad
        // Refresh tokens se manejan en AuthService
        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn: '15m', // ✅ Access tokens cortos
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LoginRateLimitGuard,
    TokenCleanupService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
