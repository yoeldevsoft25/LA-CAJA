import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Param,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto, RefreshTokenResponseDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { SecurityAuditService } from '../security/security-audit.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly securityAudit: SecurityAuditService,
  ) {}

  @Get('stores')
  async getStores(): Promise<Array<{ id: string; name: string }>> {
    return this.authService.getStores();
  }

  @Get('stores/:storeId/cashiers')
  async getCashiers(
    @Request() req: any,
    @Param('storeId') storeId: string,
  ): Promise<
    Array<{ user_id: string; full_name: string | null; role: string }>
  > {
    return this.authService.getCashiers(storeId);
  }

  @Get('debug/me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req: any): Promise<any> {
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
  @HttpCode(HttpStatus.CREATED)
  async createStore(
    @Body() dto: CreateStoreDto,
    @Request() req: any,
  ): Promise<{ store: any; member: any }> {
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
    @Request() req: any,
  ): Promise<any> {
    const ownerUserId = req.user.sub;
    return this.authService.createCashier(dto, ownerUserId);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 intentos por minuto (más estricto que login)
  async register(
    @Body() dto: RegisterDto,
    @Request() req: any,
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
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginRateLimitGuard) // Bloqueo progresivo
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  async login(
    @Body() body: any,
    @Request() req: any,
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

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    this.logger.log(`Intento de login para tienda: ${dto.store_id}`);

    try {
      const deviceId = body.device_id || req.headers['x-device-id'] || null;
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
      // ✅ Registrar login fallido
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
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 intentos por minuto
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Request() req: any,
  ): Promise<RefreshTokenResponseDto> {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

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

      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() body: { refresh_token?: string },
    @Request() req: any,
  ): Promise<{ message: string }> {
    const user = req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (body.refresh_token) {
      // Revocar refresh token específico
      await this.authService.revokeRefreshToken(
        body.refresh_token,
        'logout',
      );
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
}
