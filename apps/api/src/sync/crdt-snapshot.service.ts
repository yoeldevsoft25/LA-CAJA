import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrdtSnapshot } from '../database/entities/crdt-snapshot.entity';
import { Event } from '../database/entities/event.entity';
import { CRDTService } from './crdt.service';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import * as crypto from 'crypto';

@Injectable()
export class CrdtSnapshotService {
  private readonly logger = new Logger(CrdtSnapshotService.name);

  constructor(
    @InjectRepository(CrdtSnapshot)
    private snapshotRepo: Repository<CrdtSnapshot>,
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    private crdtService: CRDTService,
    private metricsService: SyncMetricsService,
  ) {}

  /**
   * Ejecuta la compactación cada 30 minutos
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCompactionCron() {
    await this.runCompactionBatch();
  }

  /**
   * Ejecuta la purga de eventos cada noche
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePurgeCron() {
    await this.purgeProcessedEvents();
  }

  /**
   * Crea o actualiza un snapshot para una entidad específica
   */
  async createSnapshot(storeId: string, entity: string, entityId: string) {
    // 1. Obtener el último snapshot
    let snapshot = await this.snapshotRepo.findOne({
      where: { store_id: storeId, entity, entity_id: entityId },
    });

    const startVersion = snapshot ? snapshot.version : 0;

    // 2. Obtener eventos pendientes (no absorbidos en el snapshot)
    const pendingEvents = await this.eventRepo.find({
      where: {
        store_id: storeId,
        type: this.getEventTypeForEntity(entity),
        // Simplificación: usamos version o seq para determinar el progreso
        version: MoreThan(startVersion),
      },
      order: { version: 'ASC' },
    });

    if (pendingEvents.length === 0) {
      return snapshot;
    }

    // 3. Aplicar deltas al estado del snapshot
    let state = snapshot
      ? snapshot.state
      : this.getInitialStateForEntity(entity);
    let vectorClock = snapshot ? snapshot.vector_clock : {};
    let lastEventAt = snapshot ? snapshot.last_event_at : new Date(0);
    let eventCount = snapshot ? snapshot.event_count : 0;

    for (const event of pendingEvents) {
      if (event.delta_payload) {
        state = this.crdtService.applyDelta(entity, state, event.delta_payload);
      }
      // Mezclar vector clocks
      if (event.vector_clock) {
        vectorClock = this.mergeClocks(vectorClock, event.vector_clock);
      }
      if (event.created_at > lastEventAt) {
        lastEventAt = event.created_at;
      }
      eventCount++;
    }

    const latestVersion = pendingEvents[pendingEvents.length - 1].version;
    const hash = this.calculateHash(state);

    // 4. Persistir snapshot
    if (!snapshot) {
      snapshot = this.snapshotRepo.create({
        store_id: storeId,
        entity,
        entity_id: entityId,
      });
    }

    snapshot.hash = hash;
    snapshot.state = state;
    snapshot.vector_clock = vectorClock;
    snapshot.version = latestVersion;
    snapshot.last_event_at = lastEventAt;
    snapshot.event_count = eventCount;

    this.metricsService.trackSnapshotCreated(storeId, entity, latestVersion);
    return await this.snapshotRepo.save(snapshot);
  }

  /**
   * Ejecuta la compactación para todas las entidades que tienen eventos nuevos
   */
  async runCompactionBatch() {
    this.logger.log('Iniciando batch de compactación de CRDTs...');

    // 1. Descubrir entidades con eventos pendientes
    // Buscamos store_id, type (mapeado a entity) y payload->id (entity_id)
    // Para simplificar, procesaremos las tiendas activas y sus tipos críticos
    const stores = await this.snapshotRepo.query(
      'SELECT DISTINCT store_id FROM events',
    );

    for (const { store_id } of stores) {
      // Entidades críticas a compactar
      const entities = ['cash', 'inventory', 'product'];
      for (const entity of entities) {
        // Obtenemos todos los entity_id distintos para esta tienda y tipo
        const eventType = this.getEventTypeForEntity(entity);
        const rows = await this.eventRepo.query(
          `SELECT DISTINCT COALESCE(payload->>'id', payload->>'movement_id', payload->>'sale_id') as eid 
           FROM events WHERE store_id = $1 AND type = $2`,
          [store_id, eventType],
        );

        for (const row of rows) {
          if (row.eid) {
            try {
              await this.createSnapshot(store_id, entity, row.eid);
            } catch (err) {
              this.logger.error(
                `Error compactando ${entity}:${row.eid} para tienda ${store_id}`,
                err.stack,
              );
            }
          }
        }
      }
    }

    this.logger.log('Batch de compactación finalizado.');
  }

  /**
   * Elimina eventos que ya han sido absorbidos por snapshots
   * Mantiene un margen de seguridad (ej. los últimos 1000 eventos o 7 días)
   */
  async purgeProcessedEvents() {
    this.logger.log('Iniciando purga de eventos (GC)...');

    // Obtenemos los snapshots para saber hasta qué versión podemos borrar
    const snapshots = await this.snapshotRepo.find();

    let totalPurged = 0;
    for (const snap of snapshots) {
      const result = await this.eventRepo
        .createQueryBuilder()
        .delete()
        .where('store_id = :sid', { sid: snap.store_id })
        .andWhere('type = :type', {
          type: this.getEventTypeForEntity(snap.entity),
        })
        .andWhere('version <= :ver', { ver: snap.version })
        // Margen de seguridad: no borrar nada creado en las últimas 24h
        .andWhere("created_at < NOW() - INTERVAL '1 day'")
        .execute();

      totalPurged += result.affected || 0;
    }

    this.logger.log(`Purga finalizada. Eventos eliminados: ${totalPurged}`);
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

  private mergeClocks(
    a: Record<string, number>,
    b: Record<string, number>,
  ): Record<string, number> {
    const res = { ...a };
    for (const [k, v] of Object.entries(b)) {
      res[k] = Math.max(res[k] || 0, v);
    }
    return res;
  }

  private calculateHash(state: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(state))
      .digest('hex');
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
