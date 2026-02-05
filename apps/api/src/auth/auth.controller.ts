import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Param,
  Delete,
  BadRequestException,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPinDto } from './dto/forgot-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { Enable2FADto } from './dto/enable-2fa.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { SecurityAuditService } from '../security/security-audit.service';
import { AdminApiGuard } from '../admin/admin-api.guard';
import { RequestWithUser } from './auth.types';
import { getClientIp } from '../common/utils/client-ip.util';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  /**
   * Lista pública de tiendas (solo id y nombre) para flujo de login
   */
  @Get('stores/public')
  async getPublicStores(): Promise<Array<{ id: string; name: string }>> {
    const stores = await this.authService.getStores();
    return stores.map((store) => ({ id: store.id, name: store.name }));
  }

  /**
   * Lista completa de tiendas (solo autenticado)
   */
  @Get('stores')
  @UseGuards(JwtAuthGuard)
  async getStores(): Promise<
    Array<{
      id: string;
      name: string;
      license_status: string;
      license_expires_at: Date | null;
    }>
  > {
    return this.authService.getStores();
  }

  /**
   * Lista pública de cajeros para login (solo datos mínimos)
   */
  @Get('stores/:storeId/cashiers/public')
  async getPublicCashiers(
    @Req() req: Request,
    @Param('storeId') storeId: string,
  ): Promise<
    Array<{ user_id: string; full_name: string | null; role: string }>
  > {
    return this.authService.getCashiers(storeId);
  }

  @Get('stores/:storeId/cashiers')
  @UseGuards(JwtAuthGuard)
  async getCashiers(
    @Req() req: RequestWithUser,
    @Param('storeId') storeId: string,
  ): Promise<
    Array<{ user_id: string; full_name: string | null; role: string }>
  > {
    return this.authService.getCashiers(storeId);
  }

  @Get('debug/me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: RequestWithUser): Promise<{
    userFromRequest: any;
    userFromDB: any;
    comparison: any;
    allMembersInStore: any[];
  }> {
    // Endpoint de depuración para verificar el usuario actual
    const userId = req.user?.sub;
    const storeId = req.user?.store_id;
    const roleInToken = req.user?.role;

    // Obtener el miembro desde la base de datos
    const member = await this.authService.validateUser(userId, storeId);

    return {
      userFromRequest: req.user,
      userFromDB: member
        ? {
            user_id: member.user_id,
            store_id: member.store_id,
            role: member.role,
            full_name: member.profile?.full_name,
          }
        : null,
      comparison: {
        roleInToken,
        roleInDB: member?.role,
        match: roleInToken === member?.role,
      },
      allMembersInStore: await this.authService.getAllMembersInStore(storeId),
    };
  }

  @Post('stores')
  @UseGuards(AdminApiGuard)
  @HttpCode(HttpStatus.CREATED)
  async createStore(
    @Body() dto: CreateStoreDto,
    @Req() req: RequestWithUser,
  ): Promise<{
    store: { id: string; name: string };
    member: { role: string };
  }> {
    // TODO: En producción, obtener userId del token JWT
    // Por ahora usamos un UUID temporal para desarrollo
    const ownerUserId = req.user?.sub || '00000000-0000-0000-0000-000000000001';
    return this.authService.createStore(dto, ownerUserId);
  }

  @Post('cashiers')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCashier(
    @Body() dto: CreateCashierDto,
    @Req() req: RequestWithUser,
  ): Promise<{ id: string; full_name: string | null }> {
    const ownerUserId = req.user.sub;
    return this.authService.createCashier(dto, ownerUserId);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60 } }) // 3 intentos por minuto (más estricto que login)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
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
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    this.logger.log(`Intento de registro para tienda: ${dto.store_name}`);

    try {
      const result = await this.authService.register(dto, ipAddress);

      // ✅ Registrar registro exitoso
      await this.securityAudit.log({
        event_type: 'registration_success',
        store_id: result.store_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/register',
        request_method: 'POST',
        status: 'success',
        details: {
          store_name: dto.store_name,
          owner_name: dto.owner_name,
        },
      });

      this.logger.log(
        `Registro exitoso: tienda ${result.store_id} - ${dto.store_name}`,
      );
      return result;
    } catch (error) {
      // ✅ Registrar registro fallido
      await this.securityAudit.log({
        event_type: 'registration_failure',
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/register',
        request_method: 'POST',
        status: 'failure',
        details: {
          error: error instanceof Error ? error.message : String(error),
          store_name: dto.store_name,
        },
      });

      this.logger.warn(
        `Registro fallido para tienda: ${dto.store_name} - ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60 } }) // 5 intentos por minuto
  async verifyEmail(
    @Body() body: { token: string },
  ): Promise<{ verified: boolean; message: string }> {
    if (!body.token) {
      throw new BadRequestException('Token de verificación es requerido');
    }

    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3600 } }) // 3 intentos por hora
  async resendVerificationEmail(
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }

    await this.authService.resendVerificationEmail(userId);
    return { message: 'Email de verificación enviado' };
  }

  @Post('forgot-pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600 } }) // 3 intentos por hora (muy estricto)
  async forgotPin(
    @Body() dto: ForgotPinDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    this.logger.log(
      `Solicitud de recuperación de PIN para email: ${dto.email}`,
    );

    try {
      const result = await this.authService.forgotPin(dto, ipAddress);

      // Registrar intento (éxito o no, por seguridad no revelamos si el email existe)
      await this.securityAudit.log({
        event_type: 'admin_action',
        store_id: dto.store_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/forgot-pin',
        request_method: 'POST',
        status: 'success',
        details: {
          action: 'forgot_pin_request',
        },
      });

      return result;
    } catch (error) {
      // Registrar error
      await this.securityAudit.log({
        event_type: 'unauthorized_access',
        store_id: dto.store_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/forgot-pin',
        request_method: 'POST',
        status: 'failure',
        details: {
          error: error instanceof Error ? error.message : String(error),
          action: 'forgot_pin_request',
        },
      });

      throw error;
    }
  }

  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60 } }) // 5 intentos por minuto
  async resetPin(
    @Body() dto: ResetPinDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    this.logger.log('Intento de restablecimiento de PIN');

    try {
      const result = await this.authService.resetPin(dto);

      // Registrar restablecimiento exitoso
      await this.securityAudit.log({
        event_type: 'admin_action',
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/reset-pin',
        request_method: 'POST',
        status: 'success',
        details: {
          action: 'pin_reset',
        },
      });

      return result;
    } catch (error) {
      // Registrar error
      await this.securityAudit.log({
        event_type: 'unauthorized_access',
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/reset-pin',
        request_method: 'POST',
        status: 'failure',
        details: {
          error: error instanceof Error ? error.message : String(error),
          action: 'pin_reset',
        },
      });

      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginRateLimitGuard) // Bloqueo progresivo
  @Throttle({ default: { limit: 5, ttl: 60 } }) // 5 intentos por minuto
  async login(
    @Body() body: any,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    // Validación manual antes de pasar al DTO (mantener compatibilidad con frontend)
    if (!body || !body.store_id || !body.pin) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          !body?.store_id ? 'store_id should not be empty' : null,
          !body?.pin ? 'pin should not be empty' : null,
        ].filter(Boolean),
      });
    }

    // Normalizar y limpiar valores
    const dto: LoginDto = {
      store_id: String(body.store_id).trim(),
      pin: String(body.pin).trim(),
    };

    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    this.logger.log(`Intento de login para tienda: ${dto.store_id}`);

    try {
      const deviceId =
        body.device_id || (req.headers['x-device-id'] as string) || null;
      const result = await this.authService.login(dto, deviceId, ipAddress);

      // ✅ Registrar login exitoso
      await this.securityAudit.log({
        event_type: 'login_success',
        store_id: dto.store_id,
        user_id: result.user_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/login',
        request_method: 'POST',
        status: 'success',
      });

      this.logger.log(
        `Login exitoso para usuario: ${result.user_id} en tienda: ${result.store_id}`,
      );
      return result;
    } catch (error) {
      // ✅ Registrar login fallido (tanto por IP como por store_id para rate limiting mejorado)
      await this.securityAudit.log({
        event_type: 'login_failure',
        store_id: dto.store_id,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/login',
        request_method: 'POST',
        status: 'failure',
        details: {
          error: error instanceof Error ? error.message : String(error),
          store_id: dto.store_id, // Incluir store_id en details para búsquedas
        },
      });

      this.logger.warn(
        `Login fallido para tienda: ${dto.store_id} - ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60 } }) // 10 intentos por minuto
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<RefreshTokenResponseDto> {
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    if (!dto.refresh_token) {
      // Should have been caught by DTO validation, but double checking
      throw new BadRequestException('Refresh token is required');
    }

    try {
      const result = await this.authService.refreshToken(
        dto.refresh_token,
        dto.device_id,
        ipAddress,
      );

      return result;
    } catch (error) {
      // Registrar intento fallido de refresh
      await this.securityAudit.log({
        event_type: 'unauthorized_access',
        ip_address: ipAddress,
        user_agent: userAgent,
        request_path: '/auth/refresh',
        request_method: 'POST',
        status: 'failure',
        details: {
          error: error instanceof Error ? error.message : String(error),
          reason: 'Invalid refresh token',
        },
      });

      // Ensure we re-throw specific exceptions related to auth
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      // Wrap other errors
      this.logger.error(
        `Refresh token error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Could not refresh token');
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() body: { refresh_token?: string },
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    const user = req.user;
    const ipAddress = getClientIp(req);

    if (body.refresh_token) {
      // Revocar refresh token específico
      await this.authService.revokeRefreshToken(body.refresh_token, 'logout');
    } else {
      // Revocar todos los tokens del usuario
      await this.authService.revokeAllUserTokens(
        user.sub,
        user.store_id,
        'logout_all',
      );
    }

    // Registrar logout
    await this.securityAudit.log({
      event_type: 'admin_action',
      store_id: user.store_id,
      user_id: user.sub,
      ip_address: ipAddress,
      request_path: '/auth/logout',
      request_method: 'POST',
      status: 'success',
      details: {
        action: 'logout',
      },
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getActiveSessions(@Req() req: RequestWithUser): Promise<
    Array<{
      id: string;
      device_id: string | null;
      device_info: string | null;
      ip_address: string | null;
      created_at: Date;
      last_used_at: Date | null;
    }>
  > {
    const user = req.user;
    return this.authService.getActiveSessions(user.sub, user.store_id);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    const user = req.user;
    await this.authService.revokeSession(sessionId, user.sub, user.store_id);
    return { message: 'Sesión revocada correctamente' };
  }

  @Get('2fa/initiate')
  @UseGuards(JwtAuthGuard)
  async initiate2FA(@Req() req: RequestWithUser): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const user = req.user;
    return this.authService.initiate2FA(user.sub, user.store_id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable2FA(
    @Body() dto: Enable2FADto,
    @Req() req: RequestWithUser,
  ): Promise<{ enabled: boolean; message: string }> {
    const user = req.user;
    return this.authService.enable2FA(user.sub, user.store_id, dto);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable2FA(
    @Body() body: { verification_code: string },
    @Req() req: RequestWithUser,
  ): Promise<{ disabled: boolean; message: string }> {
    const user = req.user;
    return this.authService.disable2FA(
      user.sub,
      user.store_id,
      body.verification_code,
    );
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verify2FA(
    @Body() dto: Verify2FADto,
    @Req() req: RequestWithUser,
  ): Promise<{ verified: boolean }> {
    const user = req.user;
    return this.authService.verify2FACode(user.sub, user.store_id, dto);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@Req() req: RequestWithUser): Promise<{
    is_enabled: boolean;
    enabled_at: Date | null;
  }> {
    const user = req.user;
    return this.authService.get2FAStatus(user.sub, user.store_id);
  }
}
