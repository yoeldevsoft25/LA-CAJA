import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensesController } from './licenses.controller';
import { AdminLicensePaymentsController } from './admin-license-payments.controller';
import { LicensePaymentsService } from './license-payments.service';
import { LicenseVerificationService } from './license-verification.service';
import { LicenseBankIntegrationService } from './license-bank-integration.service';
import {
  LicensePayment,
  LicensePaymentDocument,
  LicensePaymentVerification,
  SubscriptionPlan,
  StoreLicense,
  LicenseUsage,
} from '../database/entities';
import { Store } from '../database/entities/store.entity';
import { Profile } from '../database/entities/profile.entity';
import { SecurityModule } from '../security/security.module';
import { LicenseService } from './license-core.service';
import { UsageService } from './usage.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuotaGuard } from './guards/quota.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LicensePayment,
      LicensePaymentDocument,
      LicensePaymentVerification,
      SubscriptionPlan,
      StoreLicense,
      LicenseUsage,
      Store,
      Profile,
    ]),
    SecurityModule, // ✅ Necesario para AdminApiGuard (usa SecurityAuditService)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [LicensesController, AdminLicensePaymentsController],
  providers: [
    LicensePaymentsService,
    LicenseVerificationService,
    LicenseBankIntegrationService,
    LicenseService,
    UsageService,
    QuotaGuard,
  ],
  exports: [
    LicensePaymentsService,
    LicenseVerificationService,
    LicenseBankIntegrationService,
    LicenseService,
    UsageService,
    QuotaGuard,
  ],
})
export class LicensesModule { }
