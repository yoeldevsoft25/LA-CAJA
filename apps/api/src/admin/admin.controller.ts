import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  Post,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Delete,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../database/entities/store.entity';
import { StoreMember } from '../database/entities/store-member.entity';
import { Profile } from '../database/entities/profile.entity';
import { AdminApiGuard } from './admin-api.guard';
import { CreateTrialDto, UpdateLicenseDto } from './dto/update-license.dto';
import { AdminCreateUserDto } from './dto/admin-user.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AdminCreateStoreDto } from './dto/admin-store.dto';

@Controller('admin')
@UseGuards(AdminApiGuard)
export class AdminController {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(StoreMember)
    private readonly memberRepo: Repository<StoreMember>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
  ) {}

  @Get('stores')
  async listStores(
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('expiring_in_days') expiringInDays?: string,
  ) {
    const qb = this.storeRepo.createQueryBuilder('s').orderBy('s.created_at', 'DESC');

    if (status) {
      qb.andWhere('s.license_status = :status', { status });
    }
    if (plan) {
      qb.andWhere('s.license_plan = :plan', { plan });
    }
    if (expiringInDays) {
      const days = Number(expiringInDays);
      if (Number.isFinite(days)) {
        qb.andWhere('s.license_expires_at IS NOT NULL');
        qb.andWhere('s.license_expires_at <= :dateLimit', {
          dateLimit: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        });
      }
    }

    const stores = await qb.getMany();

    const members = await this.memberRepo
      .createQueryBuilder('m')
      .leftJoin(Profile, 'p', 'p.id = m.user_id')
      .select([
        'm.store_id as store_id',
        'm.user_id as user_id',
        'm.role as role',
        'p.full_name as full_name',
      ])
      .getRawMany();

    const membersByStore: Record<
      string,
      { user_id: string; role: string; full_name: string | null }[]
    > = {};

    for (const m of members) {
      if (!membersByStore[m.store_id]) membersByStore[m.store_id] = [];
      membersByStore[m.store_id].push({
        user_id: m.user_id,
        role: m.role,
        full_name: m.full_name ?? null,
      });
    }

    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      license_status: s.license_status,
      license_plan: s.license_plan,
      license_expires_at: s.license_expires_at,
      license_grace_days: s.license_grace_days,
      license_notes: s.license_notes,
      created_at: s.created_at,
      member_count: membersByStore[s.id]?.length ?? 0,
      members: membersByStore[s.id] ?? [],
    }));
  }

  @Patch('stores/:id/license')
  async updateLicense(@Param('id') storeId: string, @Body() dto: UpdateLicenseDto) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Store no encontrada');
    }

    if (dto.status) store.license_status = dto.status;
    if (dto.expires_at) store.license_expires_at = new Date(dto.expires_at);
    if (dto.grace_days !== undefined) store.license_grace_days = dto.grace_days;
    if (dto.plan !== undefined) store.license_plan = dto.plan;
    if (dto.notes !== undefined) store.license_notes = dto.notes;

    await this.storeRepo.save(store);
    return {
      id: store.id,
      license_status: store.license_status,
      license_plan: store.license_plan,
      license_expires_at: store.license_expires_at,
      license_grace_days: store.license_grace_days,
      license_notes: store.license_notes,
    };
  }

  @Post('stores/:id/trial')
  async startTrial(@Param('id') storeId: string, @Body() dto: CreateTrialDto) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Store no encontrada');
    }

    const days = dto.days ?? Number(process.env.LICENSE_TRIAL_DAYS ?? 14);
    const grace = dto.grace_days ?? Number(process.env.LICENSE_GRACE_DEFAULT ?? 3);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    store.license_status = 'trial';
    store.license_plan = store.license_plan ?? 'trial';
    store.license_expires_at = expiresAt;
    store.license_grace_days = grace;

    await this.storeRepo.save(store);
    return {
      id: store.id,
      license_status: store.license_status,
      license_plan: store.license_plan,
      license_expires_at: store.license_expires_at,
      license_grace_days: store.license_grace_days,
    };
  }

  @Post('stores')
  async createStore(@Body() dto: AdminCreateStoreDto) {
    const store = this.storeRepo.create({
      id: randomUUID(),
      name: dto.name,
      license_status: dto.status ?? 'active',
      license_plan: dto.plan ?? null,
      license_expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
      license_grace_days: dto.grace_days ?? Number(process.env.LICENSE_GRACE_DEFAULT ?? 3),
      license_notes: dto.notes ?? null,
    });
    const saved = await this.storeRepo.save(store);
    return {
      id: saved.id,
      name: saved.name,
      license_status: saved.license_status,
      license_plan: saved.license_plan,
      license_expires_at: saved.license_expires_at,
      license_grace_days: saved.license_grace_days,
      license_notes: saved.license_notes,
      created_at: saved.created_at,
      member_count: 0,
      members: [],
    };
  }

  @Get('stores/:id/users')
  async listUsers(@Param('id') storeId: string) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store no encontrada');

    const members = await this.memberRepo.find({
      where: { store_id: storeId },
      relations: ['profile'],
      order: { created_at: 'ASC' },
    });

    return members.map((m) => ({
      store_id: m.store_id,
      user_id: m.user_id,
      role: m.role,
      full_name: m.profile?.full_name ?? null,
      created_at: m.created_at,
    }));
  }

  @Post('stores/:id/users')
  async createUser(@Param('id') storeId: string, @Body() dto: AdminCreateUserDto) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store no encontrada');

    if (dto.role === 'cashier' && !dto.pin) {
      throw new BadRequestException('PIN es requerido para cajeros');
    }

    let userId = dto.user_id;
    if (!userId) {
      userId = randomUUID();
      const profile = this.profileRepo.create({
        id: userId,
        full_name: dto.full_name,
      });
      await this.profileRepo.save(profile);
    } else {
      let profile = await this.profileRepo.findOne({ where: { id: userId } });
      if (!profile) {
        profile = this.profileRepo.create({
          id: userId,
          full_name: dto.full_name,
        });
      } else {
        profile.full_name = dto.full_name;
      }
      await this.profileRepo.save(profile);
    }

    const existing = await this.memberRepo.findOne({ where: { store_id: storeId, user_id: userId } });
    if (existing) {
      throw new ConflictException('El usuario ya pertenece a la tienda');
    }

    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 10) : null;

    const member = this.memberRepo.create({
      store_id: storeId,
      user_id: userId,
      role: dto.role,
      pin_hash: pinHash,
    });
    await this.memberRepo.save(member);

    return {
      store_id: member.store_id,
      user_id: member.user_id,
      role: member.role,
      full_name: dto.full_name,
    };
  }

  @Delete('stores/:id/users/:userId')
  async removeUser(@Param('id') storeId: string, @Param('userId') userId: string) {
    const existing = await this.memberRepo.findOne({ where: { store_id: storeId, user_id: userId } });
    if (!existing) throw new NotFoundException('Usuario no pertenece a la tienda');
    await this.memberRepo.delete({ store_id: storeId, user_id: userId });
    return { ok: true };
  }
}
