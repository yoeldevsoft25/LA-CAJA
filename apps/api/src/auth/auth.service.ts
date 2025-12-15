import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Store } from '../database/entities/store.entity';
import { Profile } from '../database/entities/profile.entity';
import { StoreMember, StoreRole } from '../database/entities/store-member.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(StoreMember)
    private storeMemberRepository: Repository<StoreMember>,
    private jwtService: JwtService,
  ) {}

  private getTrialExpiration(): { expiresAt: Date; plan: string; graceDays: number } {
    const trialDays = Number(process.env.LICENSE_TRIAL_DAYS ?? 14);
    const graceDays = Number(process.env.LICENSE_GRACE_DEFAULT ?? 3);
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    return { expiresAt, plan: 'trial', graceDays: Number.isFinite(graceDays) ? graceDays : 3 };
  }

  async createStore(dto: CreateStoreDto, ownerUserId: string): Promise<{ store: Store; member: StoreMember }> {
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
    let profile = await this.profileRepository.findOne({ where: { id: ownerUserId } });
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

  async createCashier(dto: CreateCashierDto, ownerUserId: string): Promise<Profile> {
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
    const store = await this.storeRepository.findOne({ where: { id: dto.store_id } });
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

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Buscar store member por store_id y role cashier
    const members = await this.storeMemberRepository.find({
      where: {
        store_id: dto.store_id,
        role: 'cashier',
      },
      relations: ['profile'],
    });

    // Verificar PIN contra todos los cajeros de la tienda
    let validMember: StoreMember | null = null;
    for (const member of members) {
      if (member.pin_hash && (await bcrypt.compare(dto.pin, member.pin_hash))) {
        validMember = member;
        break;
      }
    }

    if (!validMember || !validMember.profile) {
      throw new UnauthorizedException('PIN incorrecto o cajero no encontrado');
    }

    // Validar licencia de la tienda
    const store = await this.storeRepository.findOne({ where: { id: dto.store_id } });
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
    const expires = store.license_expires_at ? store.license_expires_at.getTime() : null;
    const graceMs = (store.license_grace_days ?? 0) * 24 * 60 * 60 * 1000;

    if (!store.license_status) {
      throw new ForbiddenException('Licencia no configurada. Contacta al administrador.');
    }

    if (!expires) {
      throw new ForbiddenException('Licencia sin fecha de expiración. Contacta al administrador.');
    }

    if (store.license_status === 'suspended') {
      throw new ForbiddenException('Licencia suspendida. Contacta al administrador.');
    }

    if (expires && now > expires + graceMs) {
      throw new ForbiddenException('Licencia expirada. Contacta al administrador.');
    }

    // Generar JWT
    const payload = {
      sub: validMember.user_id,
      store_id: dto.store_id,
      role: validMember.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user_id: validMember.user_id,
      store_id: dto.store_id,
      role: validMember.role,
      full_name: validMember.profile.full_name,
      license_status: store.license_status,
      license_expires_at: store.license_expires_at,
    };
  }

  async getStores(): Promise<Array<{ id: string; name: string; license_status: string; license_expires_at: Date | null }>> {
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

  async getCashiers(storeId: string): Promise<Array<{ user_id: string; full_name: string | null; role: string }>> {
    const members = await this.storeMemberRepository.find({
      where: {
        store_id: storeId,
        role: 'cashier',
      },
      relations: ['profile'],
    });

    return members
      .filter((member) => member.profile)
      .map((member) => ({
        user_id: member.user_id,
        full_name: member.profile?.full_name || null,
        role: member.role,
      }));
  }

  async validateUser(userId: string, storeId: string): Promise<StoreMember | null> {
    return this.storeMemberRepository.findOne({
      where: {
        user_id: userId,
        store_id: storeId,
      },
      relations: ['profile'],
    });
  }
}
