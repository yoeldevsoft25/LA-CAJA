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
import { LicenseUsage } from '../database/entities/license-usage.entity';
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
    @InjectRepository(LicenseUsage)
    private readonly usageRepo: Repository<LicenseUsage>,
  ) { }

  @Get('stores')
  async listStores(
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('expiring_in_days') expiringInDays?: string,
  ) {
    const qb = this.storeRepo
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'DESC');

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
    const storeIds = stores.map((s) => s.id);

    // Fetch members
    const members = await this.memberRepo
      .createQueryBuilder('m')
      .leftJoin(Profile, 'p', 'p.id = m.user_id')
      .select([
        'm.store_id as store_id',
        'm.user_id as user_id',
        'm.role as role',
        'p.full_name as full_name',
      ])
      .where('m.store_id IN (:...storeIds)', {
        storeIds: storeIds.length > 0 ? storeIds : ['00000000-0000-0000-0000-000000000000']
      })
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

    // Fetch usage
    const usages = await this.usageRepo
      .createQueryBuilder('u')
      .select(['u.store_id', 'u.metric', 'u.used'])
      .where('u.store_id IN (:...storeIds)', {
        storeIds: storeIds.length > 0 ? storeIds : ['00000000-0000-0000-0000-000000000000']
      })
      .getMany();

    const usageByStore: Record<string, Record<string, number>> = {};
    for (const u of usages) {
      if (!usageByStore[u.store_id]) usageByStore[u.store_id] = {};
      usageByStore[u.store_id][u.metric] = u.used;
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
      usage: usageByStore[s.id] ?? {},
    }));
  }

  @Patch('stores/:id/license')
  async updateLicense(
    @Param('id') storeId: string,
    @Body() dto: UpdateLicenseDto,
  ) {
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
    const grace =
      dto.grace_days ?? Number(process.env.LICENSE_GRACE_DEFAULT ?? 3);
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
      license_grace_days:
        dto.grace_days ?? Number(process.env.LICENSE_GRACE_DEFAULT ?? 3),
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
  async createUser(
    @Param('id') storeId: string,
    @Body() dto: AdminCreateUserDto,
  ) {
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

    const existing = await this.memberRepo.findOne({
      where: { store_id: storeId, user_id: userId },
    });
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
  async removeUser(
    @Param('id') storeId: string,
    @Param('userId') userId: string,
  ) {
    const existing = await this.memberRepo.findOne({
      where: { store_id: storeId, user_id: userId },
    });
    if (!existing)
      throw new NotFoundException('Usuario no pertenece a la tienda');
    await this.memberRepo.delete({ store_id: storeId, user_id: userId });
    return { ok: true };
  }

  /**
   * Eliminar una tienda completa y todos sus datos asociados
   * ADVERTENCIA: Esta operación es irreversible
   *
   * Compatible con Supabase (sin necesidad de privilegios de superusuario)
   * Consulta information_schema para obtener solo tablas que existen con store_id
   */
  @Delete('stores/:id')
  async deleteStore(@Param('id') storeId: string) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Store no encontrada');
    }

    const queryRunner = this.storeRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();

    try {
      // PASO 1: Consultar information_schema para obtener SOLO las tablas que:
      // 1. Existen en la base de datos
      // 2. Tienen una columna llamada 'store_id'
      // 3. No son la tabla 'stores' (esa la eliminamos al final)
      const tablesWithStoreId: { table_name: string }[] = await queryRunner.query(`
        SELECT DISTINCT c.table_name
        FROM information_schema.columns c
        INNER JOIN information_schema.tables t
          ON c.table_name = t.table_name
          AND c.table_schema = t.table_schema
        WHERE c.column_name = 'store_id'
          AND c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.table_name != 'stores'
        ORDER BY c.table_name
      `);

      const existingTables = tablesWithStoreId.map((t) => t.table_name);

      // PASO 2: Obtener el orden correcto basado en foreign keys
      // Consultar las dependencias de FK para ordenar las tablas
      const fkDependencies: { child_table: string; parent_table: string }[] =
        await queryRunner.query(`
        SELECT
          tc.table_name as child_table,
          ccu.table_name as parent_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name != ccu.table_name
      `);

      // Construir grafo de dependencias
      const dependencyCount: Record<string, number> = {};
      const dependents: Record<string, string[]> = {};

      for (const table of existingTables) {
        dependencyCount[table] = 0;
        dependents[table] = [];
      }

      for (const fk of fkDependencies) {
        if (existingTables.includes(fk.child_table) && existingTables.includes(fk.parent_table)) {
          dependencyCount[fk.child_table]++;
          dependents[fk.parent_table].push(fk.child_table);
        }
      }

      // Ordenación topológica (tablas sin dependencias primero, pero las invertimos al final)
      const sortedTables: string[] = [];
      const queue = existingTables.filter((t) => dependencyCount[t] === 0);

      while (queue.length > 0) {
        const table = queue.shift()!;
        sortedTables.push(table);

        for (const dependent of dependents[table] || []) {
          dependencyCount[dependent]--;
          if (dependencyCount[dependent] === 0) {
            queue.push(dependent);
          }
        }
      }

      // Agregar tablas que no entraron en la ordenación (ciclos o sin FKs)
      for (const table of existingTables) {
        if (!sortedTables.includes(table)) {
          sortedTables.push(table);
        }
      }

      // Invertir: queremos eliminar primero las tablas hijas (las que dependen de otras)
      const deletionOrder = sortedTables.reverse();

      // PASO 3: Ejecutar eliminaciones en una transacción
      await queryRunner.startTransaction();

      let tablesCleared = 0;
      const deletedFromTables: string[] = [];

      for (const tableName of deletionOrder) {
        const result = await queryRunner.query(
          `DELETE FROM "${tableName}" WHERE store_id = $1`,
          [storeId],
        );
        // result es [rows, count] en pg
        const rowCount = Array.isArray(result) ? result[1] : (result?.rowCount ?? 0);
        if (rowCount > 0) {
          tablesCleared++;
          deletedFromTables.push(`${tableName}(${rowCount})`);
        }
      }

      // Finalmente eliminar la tienda
      await queryRunner.query(`DELETE FROM stores WHERE id = $1`, [storeId]);

      await queryRunner.commitTransaction();

      return {
        ok: true,
        message: `Tienda "${store.name}" y todos sus datos eliminados exitosamente`,
        deleted_store_id: storeId,
        tables_cleared: tablesCleared,
        tables_checked: existingTables.length,
        details: deletedFromTables,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw new BadRequestException(
        `Error al eliminar tienda: ${error.message || 'Error desconocido'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
