import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../database/entities/store.entity';

@Injectable()
export class LicenseWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LicenseWatcherService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  onModuleInit() {
    const interval = Number(process.env.LICENSE_CRON_INTERVAL_MS ?? 3600_000); // 1h
    this.runCheck().catch((err) => this.logger.error('Error en chequeo inicial', err.stack));
    this.timer = setInterval(() => {
      this.runCheck().catch((err) => this.logger.error('Error en chequeo programado', err.stack));
    }, interval);
    this.logger.log(`License watcher iniciado (intervalo ${interval}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCheck() {
    const now = Date.now();
    const stores = await this.storeRepo
      .createQueryBuilder('s')
      .where('s.license_expires_at IS NOT NULL')
      .andWhere("s.license_status != 'suspended'")
      .getMany();

    let expired = 0;
    let updated = 0;

    for (const store of stores) {
      const expires = store.license_expires_at?.getTime();
      if (!expires) continue;

      const graceMs = (store.license_grace_days ?? 0) * 24 * 60 * 60 * 1000;
      const isExpired = now > expires + graceMs;

      if (isExpired && store.license_status !== 'expired') {
        store.license_status = 'expired';
        store.license_notes = store.license_notes ?? 'Expirada automáticamente por cron';
        await this.storeRepo.save(store);
        expired++;
        updated++;
        continue;
      }

      const expiringSoon = now > expires - 7 * 24 * 60 * 60 * 1000 && now <= expires + graceMs;
      if (expiringSoon && store.license_status === 'active') {
        // No cambiamos el status, solo anotamos nota
        store.license_notes = store.license_notes ?? 'Licencia por expirar (<7d)';
        await this.storeRepo.save(store);
        updated++;
      }
    }

    if (expired || updated) {
      this.logger.log(`Chequeo licencias: ${expired} expiradas, ${updated} actualizadas`);
    }
  }
}
