import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LicenseUsage,
  StoreLicense,
  SubscriptionPlan,
} from '../database/entities';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectRepository(LicenseUsage)
    private usageRepo: Repository<LicenseUsage>,
    @InjectRepository(StoreLicense)
    private licenseRepo: Repository<StoreLicense>,
  ) {}

  /**
   * Incrementa el uso de una métrica de forma atómica
   */
  async increment(
    storeId: string,
    metric: string,
    amount: number = 1,
    entityManager?: any,
  ) {
    const repo = entityManager
      ? entityManager.getRepository(LicenseUsage)
      : this.usageRepo;

    let usage = await repo.findOne({
      where: { store_id: storeId, metric },
    });

    if (!usage) {
      usage = repo.create({
        store_id: storeId,
        metric,
        used: 0,
      });
    }

    usage.used += amount;
    usage.updated_at = new Date();

    return repo.save(usage);
  }

  /**
   * Verifica si se ha alcanzado el límite de una cuota
   * @throws ForbiddenException si se excede el límite
   */
  async checkQuota(storeId: string, metric: string) {
    const license = await this.licenseRepo.findOne({
      where: { store_id: storeId },
      relations: ['plan'],
    });

    const usage = await this.usageRepo.findOne({
      where: { store_id: storeId, metric },
    });

    const currentUsed = usage?.used || 0;

    // Prioridad: Custom Limits > Plan Limits > Infinity (si no definido)
    const limit =
      license?.custom_limits?.[metric] ??
      license?.plan?.limits?.[metric] ??
      Infinity;

    if (currentUsed >= limit) {
      this.logger.warn(
        `Store ${storeId} exceeded quota for ${metric}: ${currentUsed}/${limit}`,
      );
      throw new ForbiddenException({
        code: 'QUOTA_EXCEEDED',
        message: `Has alcanzado el límite de ${metric} para tu plan actual.`,
        metric,
        limit,
        used: currentUsed,
      });
    }

    return true;
  }

  /**
   * Resetea métricas periódicas (ej. ventas_del_mes)
   * Se llamará desde un Job cron al inicio de cada mes
   */
  async resetPeriodicMetrics(storeId: string, metric: string) {
    await this.usageRepo.update(
      { store_id: storeId, metric },
      { used: 0, period_start: new Date() },
    );
  }
}
