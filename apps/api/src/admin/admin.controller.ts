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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../database/entities/store.entity';
import { AdminApiGuard } from './admin-api.guard';
import { CreateTrialDto, UpdateLicenseDto } from './dto/update-license.dto';

@Controller('admin')
@UseGuards(AdminApiGuard)
export class AdminController {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
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
    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      license_status: s.license_status,
      license_plan: s.license_plan,
      license_expires_at: s.license_expires_at,
      license_grace_days: s.license_grace_days,
      license_notes: s.license_notes,
      created_at: s.created_at,
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
}
