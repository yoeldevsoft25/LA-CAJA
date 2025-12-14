import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
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

  async createStore(dto: CreateStoreDto, ownerUserId: string): Promise<{ store: Store; member: StoreMember }> {
    // Crear tienda
    const store = this.storeRepository.create({
      id: randomUUID(),
      name: dto.name,
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
    };
  }

  async getStores(): Promise<Array<{ id: string; name: string }>> {
    const stores = await this.storeRepository.find({
      order: { created_at: 'DESC' },
    });
    return stores.map((store) => ({
      id: store.id,
      name: store.name,
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

