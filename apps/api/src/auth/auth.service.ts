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
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRES_IN = 15 * 60; // 15 minutos en segundos
  private readonly REFRESH_TOKEN_EXPIRES_IN_DAYS = 30; // 30 días

  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(StoreMember)
    private storeMemberRepository: Repository<StoreMember>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private getTrialExpiration(): {
    expiresAt: Date;
    plan: string;
    graceDays: number;
  } {
    const trialDays = Number(process.env.LICENSE_TRIAL_DAYS ?? 14);
    const graceDays = Number(process.env.LICENSE_GRACE_DEFAULT ?? 3);
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    return {
      expiresAt,
      plan: 'trial',
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
      if (member.pin_hash && (await bcrypt.compare(dto.pin, member.pin_hash))) {
        validMember = member;
        break;
      }
    }

    if (!validMember || !validMember.profile) {
      throw new UnauthorizedException('PIN incorrecto o usuario no encontrado');
    }

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
      expiresIn: `${this.ACCESS_TOKEN_EXPIRES_IN}s`,
    });

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

    // Verificar que esté activo
    if (!refreshToken.isActive()) {
      throw new UnauthorizedException('Refresh token expirado o revocado');
    }

    // Verificar licencia de la tienda
    const store = refreshToken.store;
    if (!store) {
      throw new UnauthorizedException('Tienda no encontrada');
    }

    const now = Date.now();
    const expires = store.license_expires_at
      ? store.license_expires_at.getTime()
      : null;
    const graceMs = (store.license_grace_days ?? 0) * 24 * 60 * 60 * 1000;

    if (
      !store.license_status ||
      store.license_status === 'suspended' ||
      (expires && now > expires + graceMs)
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
      expiresIn: `${this.ACCESS_TOKEN_EXPIRES_IN}s`,
    });

    // Actualizar last_used_at del refresh token
    refreshToken.last_used_at = new Date();
    if (deviceId) {
      refreshToken.device_id = deviceId;
    }
    if (ipAddress) {
      refreshToken.ip_address = ipAddress;
    }
    await this.refreshTokenRepository.save(refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshTokenValue, // Devolver el mismo refresh token
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
    return this.storeMemberRepository.findOne({
      where: {
        user_id: userId,
        store_id: storeId,
      },
      relations: ['profile'],
    });
  }
}
