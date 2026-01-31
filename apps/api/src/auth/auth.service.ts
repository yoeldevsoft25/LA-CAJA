import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Store } from '../database/entities/store.entity';
import { Profile } from '../database/entities/profile.entity';
import { StoreMember } from '../database/entities/store-member.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { EmailVerificationToken } from '../database/entities/email-verification-token.entity';
import { PinRecoveryToken } from '../database/entities/pin-recovery-token.entity';
import { TwoFactorAuth } from '../database/entities/two-factor-auth.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPinDto } from './dto/forgot-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { Enable2FADto } from './dto/enable-2fa.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.dto';
import { EmailService } from '../notifications/services/email.service';
import { UsageService } from '../licenses/usage.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRES_IN = 15 * 60; // 15 minutos en segundos
  private readonly REFRESH_TOKEN_EXPIRES_IN_DAYS = 30; // 30 días
  private readonly REFRESH_TOKEN_GRACE_MS = 30 * 1000; // 30s para refresh concurrente

  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(StoreMember)
    private storeMemberRepository: Repository<StoreMember>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationTokenRepository: Repository<EmailVerificationToken>,
    @InjectRepository(PinRecoveryToken)
    private pinRecoveryTokenRepository: Repository<PinRecoveryToken>,
    @InjectRepository(TwoFactorAuth)
    private twoFactorAuthRepository: Repository<TwoFactorAuth>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private usageService: UsageService,
    private dataSource: DataSource,
  ) { }

  private getTrialExpiration(plan: 'trial' | 'freemium' = 'trial'): {
    expiresAt: Date;
    plan: string;
    graceDays: number;
  } {
    const trialDays = Number(process.env.LICENSE_TRIAL_DAYS ?? 14);
    const graceDays = Number(process.env.LICENSE_GRACE_DEFAULT ?? 3);
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    return {
      expiresAt,
      plan,
      graceDays: Number.isFinite(graceDays) ? graceDays : 3,
    };
  }

  async createStore(
    dto: CreateStoreDto,
    ownerUserId: string,
  ): Promise<{ store: Store; member: StoreMember }> {
    // Crear tienda
    const trial = this.getTrialExpiration();
    const store = this.storeRepository.create({
      id: randomUUID(),
      name: dto.name,
      license_status: 'active',
      license_plan: trial.plan,
      license_expires_at: trial.expiresAt,
      license_grace_days: trial.graceDays,
    });

    const savedStore = await this.storeRepository.save(store);

    // Asociar owner a la tienda (si no existe el profile, crearlo)
    let profile = await this.profileRepository.findOne({
      where: { id: ownerUserId },
    });
    if (!profile) {
      profile = this.profileRepository.create({
        id: ownerUserId,
        full_name: null,
      });
      await this.profileRepository.save(profile);
    }

    const member = this.storeMemberRepository.create({
      store_id: savedStore.id,
      user_id: ownerUserId,
      role: 'owner',
      pin_hash: null,
    });

    const savedMember = await this.storeMemberRepository.save(member);

    return { store: savedStore, member: savedMember };
  }

  async createCashier(
    dto: CreateCashierDto,
    ownerUserId: string,
  ): Promise<Profile> {
    // Verificar que el usuario es owner de la tienda
    const ownerMember = await this.storeMemberRepository.findOne({
      where: {
        store_id: dto.store_id,
        user_id: ownerUserId,
        role: 'owner',
      },
    });

    if (!ownerMember) {
      throw new UnauthorizedException('Solo el owner puede crear cajeros');
    }

    // Verificar que el store existe
    const store = await this.storeRepository.findOne({
      where: { id: dto.store_id },
    });
    if (!store) {
      throw new UnauthorizedException('Tienda no encontrada');
    }

    // Crear perfil para el cajero
    const profileId = randomUUID();
    const profile = this.profileRepository.create({
      id: profileId,
      full_name: dto.full_name,
    });
    await this.profileRepository.save(profile);

    // Hashear PIN
    const pinHash = await bcrypt.hash(dto.pin, 10);

    // Crear store member como cashier
    const member = this.storeMemberRepository.create({
      store_id: dto.store_id,
      user_id: profileId,
      role: 'cashier',
      pin_hash: pinHash,
    });
    await this.storeMemberRepository.save(member);

    return profile;
  }

  /**
   * Registra una nueva tienda con owner y cashier, asignando licencia freemium
   * Usa transacción para asegurar integridad de datos
   */
  async register(
    dto: RegisterDto,
    ipAddress?: string,
  ): Promise<{
    store_id: string;
    store_name: string;
    owner_id: string;
    cashier_id: string;
    license_status: string;
    license_plan: string;
    license_expires_at: Date | null;
    license_grace_days: number;
    trial_days_remaining: number;
  }> {
    this.logger.log(`Intento de registro para tienda: ${dto.store_name}`);

    // Usar transacción para asegurar integridad de datos
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el email no esté en uso
      const existingProfile = await queryRunner.manager.findOne(Profile, {
        where: { email: dto.owner_email.toLowerCase().trim() },
      });
      if (existingProfile) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('Este email ya está registrado');
      }

      // Crear tienda con licencia freemium
      const freemiumLicense = this.getTrialExpiration('freemium');
      const storeId = randomUUID();
      const store = queryRunner.manager.create(Store, {
        id: storeId,
        name: dto.store_name,
        license_status: 'active',
        license_plan: freemiumLicense.plan,
        license_expires_at: freemiumLicense.expiresAt,
        license_grace_days: freemiumLicense.graceDays,
      });

      const savedStore = await queryRunner.manager.save(Store, store);

      // Crear perfil del owner con email
      const ownerId = randomUUID();
      const ownerProfile = queryRunner.manager.create(Profile, {
        id: ownerId,
        full_name: dto.owner_name,
        email: dto.owner_email.toLowerCase().trim(),
        email_verified: false,
      });
      await queryRunner.manager.save(Profile, ownerProfile);

      // Hashear PIN del owner
      const ownerPinHash = await bcrypt.hash(dto.owner_pin, 10);

      // Crear store member como owner (con PIN)
      const ownerMember = queryRunner.manager.create(StoreMember, {
        store_id: savedStore.id,
        user_id: ownerId,
        role: 'owner',
        pin_hash: ownerPinHash,
      });
      await queryRunner.manager.save(StoreMember, ownerMember);

      // Crear perfil del cashier
      const cashierId = randomUUID();
      const cashierProfile = queryRunner.manager.create(Profile, {
        id: cashierId,
        full_name: dto.cashier_name,
      });
      await queryRunner.manager.save(Profile, cashierProfile);

      // Hashear PIN del cashier
      const pinHash = await bcrypt.hash(dto.cashier_pin, 10);

      // Crear store member como cashier (con PIN)
      const cashierMember = queryRunner.manager.create(StoreMember, {
        store_id: savedStore.id,
        user_id: cashierId,
        role: 'cashier',
        pin_hash: pinHash,
      });
      await queryRunner.manager.save(StoreMember, cashierMember);

      // Calcular días restantes de prueba
      const now = Date.now();
      const licenseExpiresAt = freemiumLicense.expiresAt.getTime();
      const trialDaysRemaining = Math.ceil(
        (licenseExpiresAt - now) / (1000 * 60 * 60 * 24),
      );

      // Generar token de verificación de email
      const verificationToken = randomUUID();
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24); // Expira en 24 horas

      const emailToken = queryRunner.manager.create(EmailVerificationToken, {
        user_id: ownerId,
        token: verificationToken,
        expires_at: tokenExpiresAt,
      });
      await queryRunner.manager.save(EmailVerificationToken, emailToken);

      // Incrementar uso de usuarios (Owner + Cashier = 2)
      await this.usageService.increment(savedStore.id, 'users', 2, queryRunner.manager);

      // Commit de la transacción
      await queryRunner.commitTransaction();

      // Enviar email de bienvenida con token de verificación (fuera de la transacción)
      // Si falla el email, no afecta el registro
      try {
        // Verificar que el servicio de email esté disponible
        if (!this.emailService.isAvailable()) {
          this.logger.warn(`⚠️ Email service not available - cannot send verification email to ${dto.owner_email}`);
          this.logger.warn('   Please configure RESEND_API_KEY in environment variables');
        } else {
          this.logger.log(`📧 Sending verification email to ${dto.owner_email}`);
        }

        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://veloxpos.app';
        const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

        const htmlBody = this.generateEmailHtml(
          'Bienvenido a Velox POS',
          '¡Bienvenido a Velox POS!',
          `
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">Hola <strong>${dto.owner_name}</strong>,</p>
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              Estamos encantados de tenerte a bordo. Tu tienda <strong style="color: #0f172a;">${dto.store_name}</strong> ha sido creada exitosamente y ya está lista para empezar a operar.
            </p>
            <p style="margin: 0 0 32px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              Para garantizar la seguridad de tu cuenta y liberar todas las funcionalidades, por favor verifica tu dirección de correo electrónico haciendo clic en el botón de abajo.
            </p>
            <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="center">
                  <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 16px 36px; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                    Verificar mi cuenta
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; text-align: center; line-height: 1.5;">
              Este enlace de verificación expirará en 24 horas por razones de seguridad.
            </p>
          `
        );

        await this.emailService.sendEmail({
          storeId: savedStore.id,
          to: dto.owner_email,
          toName: dto.owner_name,
          subject: 'Bienvenido a Velox POS - Verifica tu email',
          htmlBody,
          textBody: `Bienvenido a Velox POS\n\nHola ${dto.owner_name},\n\nGracias por registrarte en Velox POS. Tu tienda ${dto.store_name} ha sido creada exitosamente.\n\nPara completar tu registro, verifica tu dirección de email visitando:\n${verificationUrl}\n\nEste enlace expirará en 24 horas.`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`❌ Error enviando email de verificación a ${dto.owner_email}: ${errorMessage}`, errorStack);

        // Log detalle del error para debugging
        if (error instanceof Error) {
          this.logger.error(`   Error details: ${error.constructor.name}`, {
            message: error.message,
            name: error.name,
          });
        }
        // No fallar el registro si falla el email, pero loguear el error
      }

      this.logger.log(
        `Registro exitoso: tienda ${savedStore.id}, owner ${ownerId}, cashier ${cashierId}`,
      );

      return {
        store_id: savedStore.id,
        store_name: savedStore.name,
        owner_id: ownerId,
        cashier_id: cashierId,
        license_status: savedStore.license_status,
        license_plan: savedStore.license_plan || 'freemium',
        license_expires_at: savedStore.license_expires_at,
        license_grace_days: savedStore.license_grace_days,
        trial_days_remaining: trialDaysRemaining,
      };
    } catch (error) {
      // Log error ORIGINAL antes de intentar rollback
      this.logger.error('Error durante el proceso de registro:', error);

      // Rollback solo si la transacción está activa
      if (queryRunner.isTransactionActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          this.logger.error('Error al hacer rollback (ignorado):', rollbackError);
        }
      }
      throw error;
    } finally {
      // Liberar query runner
      await queryRunner.release();
    }
  }

  /**
   * Verifica un email usando un token de verificación
   */
  async verifyEmail(token: string): Promise<{ verified: boolean; message: string }> {
    const emailToken = await this.emailVerificationTokenRepository.findOne({
      where: { token },
      relations: ['profile'],
    });

    if (!emailToken) {
      throw new NotFoundException('Token de verificación inválido');
    }

    if (!emailToken.isActive()) {
      throw new BadRequestException('Token de verificación expirado o ya usado');
    }

    // Marcar token como usado
    emailToken.used_at = new Date();
    await this.emailVerificationTokenRepository.save(emailToken);

    // Marcar email como verificado
    const profile = emailToken.profile;
    if (profile) {
      profile.email_verified = true;
      profile.email_verified_at = new Date();
      await this.profileRepository.save(profile);
    }

    this.logger.log(`Email verificado para usuario: ${emailToken.user_id}`);

    return {
      verified: true,
      message: 'Email verificado exitosamente',
    };
  }

  /**
   * Reenvía el email de verificación
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!profile.email) {
      throw new BadRequestException('Usuario no tiene email registrado');
    }

    if (profile.email_verified) {
      throw new BadRequestException('Email ya está verificado');
    }

    // Revocar tokens anteriores no usados
    await this.emailVerificationTokenRepository.update(
      {
        user_id: userId,
        used_at: IsNull(),
      },
      {
        used_at: new Date(),
      },
    );

    // Generar nuevo token
    const verificationToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const emailToken = this.emailVerificationTokenRepository.create({
      user_id: userId,
      token: verificationToken,
      expires_at: expiresAt,
    });
    await this.emailVerificationTokenRepository.save(emailToken);

    // Verificar que el servicio de email esté disponible
    if (!this.emailService.isAvailable()) {
      throw new BadRequestException('El servicio de email no está disponible. Por favor configura RESEND_API_KEY.');
    }

    // Enviar email
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://veloxpos.app';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    this.logger.log(`📧 Sending verification email to ${profile.email}`);

    try {
      const htmlBody = this.generateEmailHtml(
        'Verifica tu email - Velox POS',
        'Verifica tu email',
        `
          <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">Hola <strong>${profile.full_name || 'Usuario'}</strong>,</p>
          <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
            Gracias por registrarte en Velox POS. Para garantizar la seguridad de tu cuenta y acceder a todas las funcionalidades, por favor verifica tu dirección de correo electrónico.
          </p>
          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center">
                <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 16px 36px; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                  Verificar mi email
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; text-align: center; line-height: 1.5;">
            Este enlace de verificación expirará en 24 horas por razones de seguridad.
          </p>
        `
      );

      await this.emailService.sendEmail({
        storeId: profile.id,
        to: profile.email,
        toName: profile.full_name || 'Usuario',
        subject: 'Verifica tu email - Velox POS',
        htmlBody,
        textBody: `Verifica tu email - Velox POS\n\nHola ${profile.full_name || 'Usuario'},\n\nGracias por registrarte en Velox POS. Para completar tu registro, verifica tu dirección de email visitando:\n${verificationUrl}\n\nEste enlace expirará en 24 horas.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`❌ Error reenviando email de verificación a ${profile.email}: ${errorMessage}`, errorStack);

      // Log detalle del error para debugging
      if (error instanceof Error) {
        this.logger.error(`   Error details: ${error.constructor.name}`, {
          message: error.message,
          name: error.name,
        });
      }

      throw new BadRequestException(`Error al enviar email de verificación: ${errorMessage}`);
    }
  }

  async login(
    dto: LoginDto,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<AuthResponseDto> {
    // Buscar store members por store_id (owner o cashier)
    const members = await this.storeMemberRepository.find({
      where: { store_id: dto.store_id },
      relations: ['profile'],
    });

    // Verificar PIN contra todos los miembros de la tienda
    let validMember: StoreMember | null = null;
    for (const member of members) {
      // Verificar si la cuenta está bloqueada
      if (member.isLocked()) {
        const minutesRemaining = Math.ceil(
          (member.locked_until!.getTime() - Date.now()) / (1000 * 60),
        );
        throw new ForbiddenException(
          `Cuenta bloqueada.Intenta nuevamente en ${minutesRemaining} minutos.`,
        );
      }

      if (member.pin_hash && (await bcrypt.compare(dto.pin, member.pin_hash))) {
        validMember = member;
        break;
      }
    }

    if (!validMember || !validMember.profile) {
      // Incrementar intentos fallidos para todos los miembros de la tienda
      for (const member of members) {
        if (member.pin_hash) {
          member.incrementFailedAttempts(5, 15); // 5 intentos, bloqueo de 15 minutos
          await this.storeMemberRepository.save(member);
        }
      }
      throw new UnauthorizedException('PIN incorrecto o usuario no encontrado');
    }

    // Login exitoso: resetear intentos fallidos
    validMember.resetFailedAttempts();
    await this.storeMemberRepository.save(validMember);

    // Verificar si el usuario tiene 2FA habilitado
    // Manejar caso donde la tabla two_factor_auth no existe (migración pendiente)
    let twoFactor: TwoFactorAuth | null = null;
    try {
      twoFactor = await this.twoFactorAuthRepository.findOne({
        where: {
          user_id: validMember.user_id,
          store_id: dto.store_id,
          is_enabled: true,
        },
      });
    } catch (error: any) {
      // Si la tabla no existe, continuar sin verificar 2FA
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        this.logger.warn(
          `Tabla two_factor_auth no existe.Migración 55 pendiente.Continuando sin verificar 2FA.`,
        );
      } else {
        // Otro tipo de error, loguear pero continuar
        this.logger.error(
          `Error verificando 2FA durante login: ${error?.message || error}`,
        );
      }
    }

    // Si tiene 2FA habilitado, requerir código 2FA antes de generar tokens
    if (twoFactor) {
      // Por ahora, permitimos login sin 2FA pero deberíamos requerirlo
      // TODO: Implementar flujo de 2FA en login (requerir código después del PIN)
      this.logger.log(
        `Usuario ${validMember.user_id} tiene 2FA habilitado, pero no se está verificando en login`,
      );
    }

    // Logging para depuración del login
    this.logger.log('[AuthService] Login exitoso:', {
      userId: validMember.user_id,
      storeId: validMember.store_id,
      role: validMember.role,
      fullName: validMember.profile?.full_name,
      allMembersInStore: members.map(m => ({
        userId: m.user_id,
        role: m.role,
        hasPin: !!m.pin_hash,
      })),
    });

    // Validar licencia de la tienda
    const store = await this.storeRepository.findOne({
      where: { id: dto.store_id },
    });
    if (!store) {
      throw new UnauthorizedException('Tienda no encontrada');
    }

    // Autocompletar licencia para tiendas antiguas sin datos
    if (!store.license_status || !store.license_expires_at) {
      const trial = this.getTrialExpiration();
      store.license_status = 'active';
      store.license_plan = store.license_plan ?? trial.plan;
      store.license_expires_at = trial.expiresAt;
      store.license_grace_days = store.license_grace_days ?? trial.graceDays;
      await this.storeRepository.save(store);
    }

    const now = Date.now();
    const expires = store.license_expires_at
      ? store.license_expires_at.getTime()
      : null;
    const graceMs = (store.license_grace_days ?? 0) * 24 * 60 * 60 * 1000;

    if (!store.license_status) {
      throw new ForbiddenException(
        'Licencia no configurada. Contacta al administrador.',
      );
    }

    if (!expires) {
      throw new ForbiddenException(
        'Licencia sin fecha de expiración. Contacta al administrador.',
      );
    }

    if (store.license_status === 'suspended') {
      throw new ForbiddenException(
        'Licencia suspendida. Contacta al administrador.',
      );
    }

    if (expires && now > expires + graceMs) {
      throw new ForbiddenException(
        'Licencia expirada. Contacta al administrador.',
      );
    }

    // Generar access token (corto: 15 minutos)
    const payload = {
      sub: validMember.user_id,
      store_id: dto.store_id,
      role: validMember.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: `${this.ACCESS_TOKEN_EXPIRES_IN} s`,
    });

    // DETECCIÓN DE NUEVOS DISPOSITIVOS: Generar fingerprint del dispositivo
    const deviceFingerprint = this.generateDeviceFingerprint(
      deviceId,
      ipAddress,
      validMember.user_id,
    );

    // Verificar si este dispositivo ya tiene sesiones activas
    const existingDeviceSession = await this.refreshTokenRepository.findOne({
      where: {
        user_id: validMember.user_id,
        store_id: dto.store_id,
        device_fingerprint: deviceFingerprint,
        revoked_at: IsNull(),
      },
      order: { created_at: 'DESC' },
    });

    // Si es un dispositivo nuevo, notificar por email
    if (!existingDeviceSession && validMember.profile?.email && validMember.profile?.email_verified) {
      try {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
        const htmlBody = this.generateEmailHtml(
          'Nuevo dispositivo detectado',
          'Nuevo dispositivo detectado',
          `
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">Hola <strong>${validMember.profile.full_name || 'Usuario'}</strong>,</p>
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">Se detectó un inicio de sesión desde un nuevo dispositivo o ubicación.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>IP:</strong> ${ipAddress || 'Desconocida'}</p>
              <p style="margin: 0; font-size: 14px;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-VE')}</p>
            </div>
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 16px; line-height: 1.6;">Si no fuiste tú, por favor:</p>
            <ol style="margin: 0 0 24px 24px; color: #475569; font-size: 16px; line-height: 1.6;">
              <li>Cambia tu PIN inmediatamente</li>
              <li>Revisa tus sesiones activas en <a href="${frontendUrl}/app/security" style="color: #2563eb; text-decoration: none;">Configuración de Seguridad</a></li>
              <li>Revoca todas las sesiones si es necesario</li>
            </ol>
            <p style="margin: 0; color: #94a3b8; font-size: 14px; text-align: center;">Si fuiste tú, puedes ignorar este email.</p>
          `
        );

        await this.emailService.sendEmail({
          storeId: dto.store_id,
          to: validMember.profile.email,
          toName: validMember.profile.full_name || 'Usuario',
          subject: 'Nuevo dispositivo detectado - Velox POS',
          htmlBody,
          textBody: `Nuevo dispositivo detectado - Velox POS\n\nHola ${validMember.profile.full_name || 'Usuario'},\n\nSe detectó un inicio de sesión desde un nuevo dispositivo.\n\nIP: ${ipAddress || 'Desconocida'}\nFecha: ${new Date().toLocaleString('es-VE')}\n\nSi no fuiste tú, cambia tu PIN inmediatamente y revisa tus sesiones activas.`,
        });
        this.logger.log(`Email de nuevo dispositivo enviado a: ${validMember.profile.email} `);
      } catch (error) {
        this.logger.error('Error enviando email de nuevo dispositivo:', error);
        // No fallar el login si falla el email
      }
    }

    // CONTROL DE SESIONES CONCURRENTES: Verificar límite de sesiones activas
    const MAX_CONCURRENT_SESSIONS = 3;
    const activeSessions = await this.refreshTokenRepository.count({
      where: {
        user_id: validMember.user_id,
        store_id: dto.store_id,
        revoked_at: IsNull(),
      },
    });

    // Si hay demasiadas sesiones activas, revocar las más antiguas
    if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
      const oldestSessions = await this.refreshTokenRepository.find({
        where: {
          user_id: validMember.user_id,
          store_id: dto.store_id,
          revoked_at: IsNull(),
        },
        order: { created_at: 'ASC' },
        take: activeSessions - MAX_CONCURRENT_SESSIONS + 1, // +1 porque vamos a agregar una nueva
      });

      for (const oldSession of oldestSessions) {
        oldSession.revoked_at = new Date();
        oldSession.revoked_reason = 'max_concurrent_sessions';
        await this.refreshTokenRepository.save(oldSession);
      }

      this.logger.log(
        `Revocadas ${oldestSessions.length} sesiones antiguas para usuario ${validMember.user_id} (límite: ${MAX_CONCURRENT_SESSIONS})`,
      );
    }

    // Generar refresh token (largo: 30 días)
    const refreshTokenValue = randomUUID();
    const refreshTokenHash = createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');

    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(
      refreshTokenExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_IN_DAYS,
    );

    // Guardar refresh token en base de datos
    const refreshToken = this.refreshTokenRepository.create({
      token: refreshTokenHash,
      user_id: validMember.user_id,
      store_id: dto.store_id,
      device_id: deviceId || null,
      device_info: null, // Se puede mejorar con más info del dispositivo
      device_fingerprint: deviceFingerprint,
      ip_address: ipAddress || null,
      expires_at: refreshTokenExpiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshTokenValue, // Enviar el valor original, no el hash
      user_id: validMember.user_id,
      store_id: dto.store_id,
      role: validMember.role,
      full_name: validMember.profile.full_name,
      license_status: store.license_status,
      license_expires_at: store.license_expires_at,
      license_plan: store.license_plan,
      expires_in: this.ACCESS_TOKEN_EXPIRES_IN,
    };
  }

  /**
   * Refresca un access token usando un refresh token válido
   */
  async refreshToken(
    refreshTokenValue: string,
    deviceId?: string,
    ipAddress?: string,
  ): Promise<RefreshTokenResponseDto> {
    // Hashear el token recibido para buscar en DB
    const refreshTokenHash = createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');

    // Buscar refresh token
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenHash },
      relations: ['store'],
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const now = new Date();
    const isExpired = refreshToken.expires_at <= now;
    const revokedAt = refreshToken.revoked_at;
    const isRevoked = Boolean(revokedAt);

    if (isExpired) {
      throw new UnauthorizedException('Refresh token expirado o revocado');
    }

    if (isRevoked) {
      const revokedReason = refreshToken.revoked_reason;
      const revokedAgoMs = revokedAt ? now.getTime() - revokedAt.getTime() : null;
      const withinGrace =
        revokedReason === 'rotated' &&
        revokedAt !== null &&
        revokedAgoMs !== null &&
        revokedAgoMs <= this.REFRESH_TOKEN_GRACE_MS;

      if (!withinGrace) {
        this.logger.warn(
          `⚠️ Posible reutilización de refresh token revocado detectada para usuario: ${refreshToken.user_id} `,
        );
        throw new UnauthorizedException('Refresh token expirado o revocado');
      }

      this.logger.debug(
        `Refresh token reutilizado dentro de ventana de gracia para usuario: ${refreshToken.user_id} `,
      );
    }

    // Verificar licencia de la tienda
    const store = refreshToken.store;
    if (!store) {
      throw new UnauthorizedException('Tienda no encontrada');
    }

    const nowMs = Date.now();
    const expires = store.license_expires_at
      ? store.license_expires_at.getTime()
      : null;
    const graceMs = (store.license_grace_days ?? 0) * 24 * 60 * 60 * 1000;

    if (
      !store.license_status ||
      store.license_status === 'suspended' ||
      (expires && nowMs > expires + graceMs)
    ) {
      throw new ForbiddenException('Licencia inválida o expirada');
    }

    // Obtener información del usuario
    const member = await this.storeMemberRepository.findOne({
      where: {
        user_id: refreshToken.user_id,
        store_id: refreshToken.store_id,
      },
    });

    if (!member) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Generar nuevo access token
    const payload = {
      sub: refreshToken.user_id,
      store_id: refreshToken.store_id,
      role: member.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: `${this.ACCESS_TOKEN_EXPIRES_IN} s`,
    });

    // ROTACIÓN DE REFRESH TOKEN: Generar nuevo refresh token y revocar el anterior
    const newRefreshTokenValue = randomUUID();
    const newRefreshTokenHash = createHash('sha256')
      .update(newRefreshTokenValue)
      .digest('hex');

    const newRefreshTokenExpiresAt = new Date();
    newRefreshTokenExpiresAt.setDate(
      newRefreshTokenExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_IN_DAYS,
    );

    // Revocar el refresh token anterior (si ya estaba revocado por rotación en grace, no actualizar)
    if (!refreshToken.revoked_at) {
      refreshToken.revoked_at = new Date();
      refreshToken.revoked_reason = 'rotated';
      await this.refreshTokenRepository.save(refreshToken);
    }

    // Crear nuevo refresh token
    const newRefreshToken = this.refreshTokenRepository.create({
      token: newRefreshTokenHash,
      user_id: refreshToken.user_id,
      store_id: refreshToken.store_id,
      device_id: deviceId || refreshToken.device_id,
      device_info: refreshToken.device_info,
      ip_address: ipAddress || refreshToken.ip_address,
      expires_at: newRefreshTokenExpiresAt,
    });
    await this.refreshTokenRepository.save(newRefreshToken);

    return {
      access_token: accessToken,
      refresh_token: newRefreshTokenValue, // Devolver el nuevo refresh token
      expires_in: this.ACCESS_TOKEN_EXPIRES_IN,
    };
  }

  /**
   * Revoca un refresh token (logout)
   */
  async revokeRefreshToken(
    refreshTokenValue: string,
    reason: string = 'logout',
  ): Promise<void> {
    const refreshTokenHash = createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenHash },
    });

    if (refreshToken && refreshToken.isActive()) {
      refreshToken.revoked_at = new Date();
      refreshToken.revoked_reason = reason;
      await this.refreshTokenRepository.save(refreshToken);
    }
  }

  /**
   * Revoca todos los refresh tokens de un usuario (logout de todos los dispositivos)
   */
  async revokeAllUserTokens(
    userId: string,
    storeId: string,
    reason: string = 'logout_all',
  ): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        user_id: userId,
        store_id: storeId,
        revoked_at: IsNull(), // Solo tokens activos
      },
      {
        revoked_at: new Date(),
        revoked_reason: reason,
      },
    );
  }

  /**
   * Obtiene todas las sesiones activas de un usuario
   */
  async getActiveSessions(
    userId: string,
    storeId: string,
  ): Promise<
    Array<{
      id: string;
      device_id: string | null;
      device_info: string | null;
      ip_address: string | null;
      created_at: Date;
      last_used_at: Date | null;
    }>
  > {
    const sessions = await this.refreshTokenRepository.find({
      where: {
        user_id: userId,
        store_id: storeId,
        revoked_at: IsNull(),
      },
      order: { last_used_at: 'DESC', created_at: 'DESC' },
    });

    return sessions
      .filter((s) => s.isActive())
      .map((s) => ({
        id: s.id,
        device_id: s.device_id,
        device_info: s.device_info,
        ip_address: s.ip_address,
        created_at: s.created_at,
        last_used_at: s.last_used_at,
      }));
  }

  /**
   * Revoca una sesión específica (por ID de refresh token)
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    storeId: string,
    reason: string = 'user_revoked',
  ): Promise<void> {
    const session = await this.refreshTokenRepository.findOne({
      where: {
        id: sessionId,
        user_id: userId,
        store_id: storeId,
      },
    });

    if (session && session.isActive()) {
      session.revoked_at = new Date();
      session.revoked_reason = reason;
      await this.refreshTokenRepository.save(session);
    }
  }

  async getStores(): Promise<
    Array<{
      id: string;
      name: string;
      license_status: string;
      license_expires_at: Date | null;
    }>
  > {
    const stores = await this.storeRepository.find({
      order: { created_at: 'DESC' },
    });
    return stores.map((store) => ({
      id: store.id,
      name: store.name,
      license_status: store.license_status,
      license_expires_at: store.license_expires_at,
    }));
  }

  async getCashiers(
    storeId: string,
  ): Promise<
    Array<{ user_id: string; full_name: string | null; role: string }>
  > {
    // Devolvemos todos los miembros (owner y cashier) para permitir login de owner con PIN
    const members = await this.storeMemberRepository.find({
      where: {
        store_id: storeId,
      },
      relations: ['profile'],
      order: { created_at: 'ASC' },
    });

    return members
      .filter((member) => member.profile)
      .map((member) => ({
        user_id: member.user_id,
        full_name: member.profile?.full_name || null,
        role: member.role,
      }));
  }

  async validateUser(
    userId: string,
    storeId: string,
  ): Promise<StoreMember | null> {
    this.logger.log('[AuthService] validateUser - Buscando usuario:', {
      userId,
      storeId,
    });

    // Primero buscar el miembro
    const member = await this.storeMemberRepository.findOne({
      where: {
        user_id: userId,
        store_id: storeId,
      },
      relations: ['profile'],
    });

    // Si no se encuentra, buscar todos los miembros de la tienda para debugging
    if (!member) {
      const allMembers = await this.storeMemberRepository.find({
        where: { store_id: storeId },
        relations: ['profile'],
      });

      this.logger.warn('[AuthService] validateUser - Usuario no encontrado:', {
        userId,
        storeId,
        searchedFor: { user_id: userId, store_id: storeId },
        allMembersInStore: allMembers.map(m => ({
          user_id: m.user_id,
          store_id: m.store_id,
          role: m.role,
          full_name: m.profile?.full_name,
        })),
      });
    } else {
      this.logger.log('[AuthService] validateUser - Usuario encontrado:', {
        userId,
        storeId,
        memberRole: member.role,
        memberId: member.user_id,
        hasProfile: !!member.profile,
        profileName: member.profile?.full_name,
        fullMemberData: {
          user_id: member.user_id,
          store_id: member.store_id,
          role: member.role,
        },
      });
    }

    return member;
  }

  async getAllMembersInStore(
    storeId: string,
  ): Promise<Array<{ user_id: string; role: string; full_name: string | null }>> {
    const members = await this.storeMemberRepository.find({
      where: { store_id: storeId },
      relations: ['profile'],
    });

    return members.map((member) => ({
      user_id: member.user_id,
      role: member.role,
      full_name: member.profile?.full_name || null,
    }));
  }

  /**
   * Solicita recuperación de PIN olvidado
   * Envía email con token de recuperación
   */
  async forgotPin(
    dto: ForgotPinDto,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    // Buscar usuario por email y store_id
    const profile = await this.profileRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!profile) {
      // No revelar si el email existe o no por seguridad
      this.logger.warn(`Intento de recuperación de PIN para email no encontrado: ${dto.email} `);
      return {
        message: 'Si el email existe, recibirás un enlace para recuperar tu PIN',
      };
    }

    // Buscar si el usuario pertenece a la tienda
    const member = await this.storeMemberRepository.findOne({
      where: {
        user_id: profile.id,
        store_id: dto.store_id,
      },
      relations: ['store'],
    });

    if (!member) {
      // No revelar si el email existe o no por seguridad
      this.logger.warn(`Intento de recuperación de PIN para usuario no perteneciente a tienda: ${dto.email} `);
      return {
        message: 'Si el email existe, recibirás un enlace para recuperar tu PIN',
      };
    }

    // Verificar que el email exista y esté verificado
    if (!profile.email) {
      throw new BadRequestException(
        'El usuario no tiene un email registrado',
      );
    }

    if (!profile.email_verified) {
      throw new BadRequestException(
        'Debes verificar tu email antes de poder recuperar tu PIN',
      );
    }

    // Revocar tokens anteriores no usados del mismo usuario
    await this.pinRecoveryTokenRepository.update(
      {
        user_id: profile.id,
        store_id: dto.store_id,
        used_at: IsNull(),
      },
      {
        used_at: new Date(),
      },
    );

    // Generar token de recuperación
    const recoveryToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira en 1 hora

    const pinToken = this.pinRecoveryTokenRepository.create({
      user_id: profile.id,
      store_id: dto.store_id,
      token: recoveryToken,
      expires_at: expiresAt,
      ip_address: ipAddress || null,
    });
    await this.pinRecoveryTokenRepository.save(pinToken);

    // Enviar email de recuperación
    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-pin?token=${recoveryToken}`;

      const htmlBody = this.generateEmailHtml(
        'Recuperación de PIN - Velox POS',
        'Recuperar tu PIN',
        `
          <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">Hola <strong>${profile.full_name || 'Usuario'}</strong>,</p>
          <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
            Hemos recibido una solicitud para restablecer el PIN de acceso a tu cuenta en Velox POS. Si no realizaste esta solicitud, puedes ignorar este correo.
          </p>
          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center">
                <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 36px; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                  Restablecer mi PIN
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; text-align: center; line-height: 1.5;">
            Este enlace expirará en 1 hora por razones de seguridad.
          </p>
        `
      );

      await this.emailService.sendEmail({
        storeId: dto.store_id,
        to: profile.email,
        toName: profile.full_name || 'Usuario',
        subject: 'Recuperación de PIN - Velox POS',
        htmlBody,
        textBody: `Recuperación de PIN - Velox POS\n\nHola ${profile.full_name || 'Usuario'},\n\nPara restablecer tu PIN, por favor visita el siguiente enlace:\n${resetUrl}\n\nEste enlace expirará en 1 hora.`,
      });

      this.logger.log(`Email de recuperación de PIN enviado a: ${profile.email}`);
    } catch (error) {
      this.logger.error('Error enviando email de recuperación de PIN:', error);
      throw new BadRequestException('Error al enviar email de recuperación');
    }

    return {
      message: 'Si el email existe, recibirás un enlace para recuperar tu PIN',
    };
  }

  /**
   * Restablece el PIN usando un token de recuperación
   */
  async resetPin(dto: ResetPinDto): Promise<{ message: string }> {
    const recoveryToken = await this.pinRecoveryTokenRepository.findOne({
      where: { token: dto.token },
      relations: ['profile', 'store'],
    });

    if (!recoveryToken) {
      throw new NotFoundException('Token de recuperación inválido');
    }

    if (!recoveryToken.isActive()) {
      throw new BadRequestException('Token de recuperación expirado o ya usado');
    }

    // Marcar token como usado
    recoveryToken.used_at = new Date();
    await this.pinRecoveryTokenRepository.save(recoveryToken);

    // Buscar el miembro de la tienda
    const member = await this.storeMemberRepository.findOne({
      where: {
        user_id: recoveryToken.user_id,
        store_id: recoveryToken.store_id,
      },
    });

    if (!member) {
      throw new NotFoundException('Usuario no encontrado en la tienda');
    }

    // Hashear nuevo PIN
    const newPinHash = await bcrypt.hash(dto.new_pin, 10);

    // Actualizar PIN
    member.pin_hash = newPinHash;
    await this.storeMemberRepository.save(member);

    // Revocar todos los refresh tokens del usuario por seguridad
    await this.revokeAllUserTokens(
      recoveryToken.user_id,
      recoveryToken.store_id,
      'pin_reset',
    );

    this.logger.log(`PIN restablecido para usuario: ${recoveryToken.user_id}`);

    return {
      message: 'PIN restablecido exitosamente. Por favor inicia sesión con tu nuevo PIN.',
    };
  }

  /**
   * Genera un fingerprint del dispositivo para detección de nuevos dispositivos
   */
  private generateDeviceFingerprint(
    deviceId: string | null | undefined,
    ipAddress: string | null | undefined,
    userId: string,
  ): string {
    // Combinar device_id, IP y user_id para crear un fingerprint único
    const components = [
      deviceId || 'no-device-id',
      ipAddress || 'no-ip',
      userId,
    ];
    const fingerprintString = components.join('|');

    // Hashear para crear un fingerprint único pero no reversible
    return createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Inicia el proceso de habilitación de 2FA
   * Genera un secret y QR code para configurar en app de autenticación
   */
  async initiate2FA(userId: string, storeId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    // Verificar que el usuario existe
    const member = await this.storeMemberRepository.findOne({
      where: { user_id: userId, store_id: storeId },
    });

    if (!member) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Generar secret para TOTP
    const secret = speakeasy.generateSecret({
      name: `Velox POS (${storeId.substring(0, 8)})`,
      issuer: 'Velox POS',
      length: 32,
    });

    // Generar códigos de respaldo (10 códigos de 8 dígitos)
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      backupCodes.push(code);
    }

    // Hashear códigos de respaldo antes de guardar
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    // Crear o actualizar registro de 2FA (aún no habilitado)
    let twoFactor: TwoFactorAuth | null = null;
    try {
      twoFactor = await this.twoFactorAuthRepository.findOne({
        where: { user_id: userId, store_id: storeId },
      });
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        throw new BadRequestException(
          'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
        );
      }
      throw error;
    }

    if (twoFactor) {
      twoFactor.secret = secret.base32;
      twoFactor.backup_codes = hashedBackupCodes;
      twoFactor.is_enabled = false;
    } else {
      twoFactor = this.twoFactorAuthRepository.create({
        user_id: userId,
        store_id: storeId,
        secret: secret.base32,
        backup_codes: hashedBackupCodes,
        is_enabled: false,
      });
    }

    try {
      await this.twoFactorAuthRepository.save(twoFactor);
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        throw new BadRequestException(
          'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
        );
      }
      throw error;
    }

    // Generar QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32, // Devolver secret para mostrar al usuario (solo una vez)
      qrCodeUrl,
      backupCodes, // Devolver códigos de respaldo (solo una vez)
    };
  }

  /**
   * Habilita 2FA después de verificar el código
   */
  async enable2FA(
    userId: string,
    storeId: string,
    dto: Enable2FADto,
  ): Promise<{ enabled: boolean; message: string }> {
    let twoFactor: TwoFactorAuth | null = null;
    try {
      twoFactor = await this.twoFactorAuthRepository.findOne({
        where: { user_id: userId, store_id: storeId },
      });
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        throw new BadRequestException(
          'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
        );
      }
      throw error;
    }

    if (!twoFactor) {
      throw new NotFoundException('2FA no iniciado. Debes iniciar el proceso primero.');
    }

    if (twoFactor.is_enabled) {
      throw new BadRequestException('2FA ya está habilitado');
    }

    // Verificar código TOTP
    const verified = speakeasy.totp.verify({
      secret: twoFactor.secret,
      encoding: 'base32',
      token: dto.verification_code,
      window: 2, // Permitir ±2 períodos de tiempo (60 segundos)
    });

    if (!verified) {
      throw new BadRequestException('Código de verificación inválido');
    }

    // Habilitar 2FA
    twoFactor.is_enabled = true;
    twoFactor.enabled_at = new Date();
    try {
      await this.twoFactorAuthRepository.save(twoFactor);
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        throw new BadRequestException(
          'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
        );
      }
      throw error;
    }

    this.logger.log(`2FA habilitado para usuario: ${userId}`);

    return {
      enabled: true,
      message: '2FA habilitado exitosamente',
    };
  }

  /**
   * Deshabilita 2FA
   */
  async disable2FA(
    userId: string,
    storeId: string,
    verificationCode: string,
  ): Promise<{ disabled: boolean; message: string }> {
    let twoFactor: TwoFactorAuth | null = null;
    try {
      twoFactor = await this.twoFactorAuthRepository.findOne({
        where: { user_id: userId, store_id: storeId },
      });
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        throw new BadRequestException(
          'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
        );
      }
      throw error;
    }

    if (!twoFactor || !twoFactor.is_enabled) {
      throw new BadRequestException('2FA no está habilitado');
    }

    // Verificar código TOTP o código de respaldo
    let verified = speakeasy.totp.verify({
      secret: twoFactor.secret,
      encoding: 'base32',
      token: verificationCode,
      window: 2,
    });

    // Si no es un código TOTP válido, verificar si es un código de respaldo
    if (!verified) {
      for (const hashedCode of twoFactor.backup_codes) {
        if (await bcrypt.compare(verificationCode, hashedCode)) {
          verified = true;
          // Remover código de respaldo usado
          twoFactor.backup_codes = twoFactor.backup_codes.filter(
            (code) => code !== hashedCode,
          );
          break;
        }
      }
    }

    if (!verified) {
      throw new BadRequestException('Código de verificación inválido');
    }

    // Deshabilitar 2FA
    twoFactor.is_enabled = false;
    twoFactor.enabled_at = null;
    try {
      await this.twoFactorAuthRepository.save(twoFactor);
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        throw new BadRequestException(
          'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
        );
      }
      throw error;
    }

    this.logger.log(`2FA deshabilitado para usuario: ${userId}`);

    return {
      disabled: true,
      message: '2FA deshabilitado exitosamente',
    };
  }

  /**
   * Verifica código 2FA durante el login
   */
  async verify2FACode(
    userId: string,
    storeId: string,
    dto: Verify2FADto,
  ): Promise<{ verified: boolean }> {
    let twoFactor: TwoFactorAuth | null = null;
    try {
      twoFactor = await this.twoFactorAuthRepository.findOne({
        where: {
          user_id: userId,
          store_id: storeId,
          is_enabled: true,
        },
      });
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        throw new BadRequestException(
          'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
        );
      }
      throw error;
    }

    if (!twoFactor) {
      throw new BadRequestException('2FA no está habilitado para este usuario');
    }

    // Verificar código TOTP
    let verified = speakeasy.totp.verify({
      secret: twoFactor.secret,
      encoding: 'base32',
      token: dto.code,
      window: 2,
    });

    // Si no es un código TOTP válido, verificar si es un código de respaldo
    if (!verified) {
      for (const hashedCode of twoFactor.backup_codes) {
        if (await bcrypt.compare(dto.code, hashedCode)) {
          verified = true;
          // Remover código de respaldo usado
          twoFactor.backup_codes = twoFactor.backup_codes.filter(
            (code) => code !== hashedCode,
          );
          twoFactor.last_used_at = new Date();
          try {
            await this.twoFactorAuthRepository.save(twoFactor);
          } catch (error: any) {
            if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
              throw new BadRequestException(
                'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
              );
            }
            throw error;
          }
          break;
        }
      }
    } else {
      // Actualizar last_used_at
      twoFactor.last_used_at = new Date();
      try {
        await this.twoFactorAuthRepository.save(twoFactor);
      } catch (error: any) {
        if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
          throw new BadRequestException(
            'La tabla two_factor_auth no existe. Por favor, ejecuta la migración 55_two_factor_auth.sql primero.',
          );
        }
        throw error;
      }
    }

    if (!verified) {
      throw new BadRequestException('Código 2FA inválido');
    }

    return { verified: true };
  }

  /**
   * Genera el HTML estándar para los correos electrónicos de la plataforma
   */
  private generateEmailHtml(title: string, headline: string, contentHtml: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <!--[if mso]>
        <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
        </noscript>
        <![endif]-->
        <style>
          body { margin: 0; padding: 0; min-width: 100%; width: 100% !important; height: 100% !important; }
          body, table, td, div, p, a { -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%; }
          table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; border-spacing: 0; }
          img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
          #outlook a { padding: 0; }
          .ReadMsgBody { width: 100%; } .ExternalClass { width: 100%; }
          .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
          @media all and (min-width: 560px) { .container { max-width: 600px !important; margin: 0 auto !important; width: 100% !important; } }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f1f5f9;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <!-- Logo Section -->
              <table class="container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 600px;">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <img src="https://veloxpos.app/login-image.svg" alt="Velox POS" width="180" style="display: block; border: 0;">
                  </td>
                </tr>
              </table>
              <!-- Card Section -->
              <table class="container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                <tr><td height="6" style="background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);"></td></tr>
                <tr>
                  <td style="padding: 40px 48px;">
                    <h1 style="margin: 0 0 24px 0; color: #1e293b; font-size: 28px; font-weight: 700; line-height: 1.25; text-align: center;">${headline}</h1>
                    ${contentHtml}
                  </td>
                </tr>
              </table>
              <!-- Footer Section -->
              <table class="container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 600px;">
                <tr>
                  <td align="center" style="padding: 32px 0;">
                    <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 14px; font-weight: 500;">Velox POS</p>
                    <p style="margin: 0 0 16px 0; color: #cbd5e1; font-size: 12px;">Optimizando tu negocio, venta a venta.</p>
                    <p style="margin: 0; color: #cbd5e1; font-size: 12px;">© ${new Date().getFullYear()} Velox POS. Todos los derechos reservados.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Obtiene el estado de 2FA para un usuario
   */
  async get2FAStatus(
    userId: string,
    storeId: string,
  ): Promise<{ is_enabled: boolean; enabled_at: Date | null }> {
    try {
      const twoFactor = await this.twoFactorAuthRepository.findOne({
        where: { user_id: userId, store_id: storeId },
      });

      return {
        is_enabled: twoFactor?.is_enabled || false,
        enabled_at: twoFactor?.enabled_at || null,
      };
    } catch (error: any) {
      // Si la tabla no existe, asumir que 2FA no está habilitado
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        this.logger.warn(
          `Tabla two_factor_auth no existe. Migración 55 pendiente. Retornando 2FA deshabilitado.`,
        );
        return {
          is_enabled: false,
          enabled_at: null,
        };
      }
      // Re-lanzar otros errores
      throw error;
    }
  }
}
