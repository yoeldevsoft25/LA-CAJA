import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrdtSnapshot } from '../database/entities/crdt-snapshot.entity';
import { Event } from '../database/entities/event.entity';
import { CRDTService } from './crdt.service';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import * as crypto from 'crypto';

@Injectable()
export class CrdtVerifyService {
  private readonly logger = new Logger(CrdtVerifyService.name);

  constructor(
    @InjectRepository(CrdtSnapshot)
    private snapshotRepo: Repository<CrdtSnapshot>,
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    private crdtService: CRDTService,
    private metricsService: SyncMetricsService,
  ) {}

  /**
   * Ejecuta la verificación de integridad cada 6 horas
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleVerificationCron() {
    await this.verifyAllSnapshots();
  }

  async verifyAllSnapshots() {
    this.logger.log('Iniciando verificación de integridad de CRDTs...');
    const snapshots = await this.snapshotRepo.find();

    let driftCount = 0;
    for (const snapshot of snapshots) {
      const isOk = await this.verifySnapshot(snapshot);
      if (!isOk) driftCount++;
    }

    if (driftCount > 0) {
      this.logger.warn(
        `Verificación finalizada. Se detectaron ${driftCount} inconsistencias (drift).`,
      );
    } else {
      this.logger.log(
        'Verificación finalizada sin inconsistencias detectadas.',
      );
    }
  }

  async verifySnapshot(snapshot: CrdtSnapshot): Promise<boolean> {
    const { store_id, entity, entity_id, version, hash } = snapshot;

    // 1. Recalcular desde cero (opcionalmente podríamos hacerlo incrementalmente)
    // Para una verificación exhaustiva, recalculamos aplicando TODOS los eventos hasta esa versión
    const events = await this.eventRepo.find({
      where: {
        store_id,
        type: this.getEventTypeForEntity(entity),
        version: MoreThanOrEqual(0), // O version <= snapshot.version
      },
      order: { version: 'ASC' },
    });

    // Filtramos manualmente por la versión del snapshot para ser precisos
    const slice = events.filter((e) => e.version <= version);

    let recalculatedState = this.getInitialStateForEntity(entity);
    for (const event of slice) {
      if (event.delta_payload) {
        recalculatedState = this.crdtService.applyDelta(
          entity,
          recalculatedState,
          event.delta_payload,
        );
      }
    }

    const recalculatedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(recalculatedState))
      .digest('hex');

    if (recalculatedHash !== hash) {
      this.logger.error(
        `DRIFT DETECTADO en ${entity}:${entity_id} (Tienda: ${store_id}). ` +
          `Hash Snapshot: ${hash}, Hash Recalculado: ${recalculatedHash}`,
      );
      this.metricsService.trackCrdtDrift(
        store_id,
        entity,
        entity_id,
        hash,
        recalculatedHash,
      );
      return false;
    }

    return true;
  }

  private getEventTypeForEntity(entity: string): string {
    switch (entity) {
      case 'product':
        return 'ProductUpdated';
      case 'inventory':
        return 'StockAdjusted';
      case 'cash':
        return 'CashSessionUpdated';
      default:
        return '';
    }
  }

  private getInitialStateForEntity(entity: string): any {
    switch (entity) {
      case 'cash':
      case 'inventory':
        return { increments: {}, decrements: {} };
      case 'product':
        return { value: null, timestamp: 0, nodeId: '' };
      default:
        return {};
    }
  }
}

// Necesitamos importar MoreThanOrEqual de TypeORM
import { MoreThanOrEqual } from 'typeorm';
