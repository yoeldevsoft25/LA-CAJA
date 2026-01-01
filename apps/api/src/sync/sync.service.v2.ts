import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import {
  PushSyncDto,
  PushSyncResponseDto,
  AcceptedEventDto,
  RejectedEventDto,
  ConflictedEventDto,
} from './dto/push-sync.dto';
import { ProjectionsService } from '../projections/projections.service';
import { SyncStatusDto } from './dto/sync-status.dto';
import { VectorClockService } from './vector-clock.service';
import { CRDTService } from './crdt.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import * as crypto from 'crypto';

/**
 * SyncService V2 - Con Vector Clocks y Resolución de Conflictos
 *
 * Mejoras sobre V1:
 * 1. Vector clocks para ordenamiento causal
 * 2. Detección automática de conflictos
 * 3. Resolución automática con CRDT
 * 4. Queue de conflictos manuales
 * 5. Delta compression (payload hash)
 */

@Injectable()
export class SyncServiceV2 {
  private readonly logger = new Logger(SyncServiceV2.name);

  // Tipos de eventos conocidos
  private readonly knownEventTypes = [
    'ProductCreated',
    'ProductUpdated',
    'ProductDeactivated',
    'PriceChanged',
    'StockReceived',
    'StockAdjusted',
    'SaleCreated',
    'CashSessionOpened',
    'CashSessionClosed',
    'CustomerCreated',
    'CustomerUpdated',
    'DebtCreated',
    'DebtPaymentRecorded',
  ];

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private projectionsService: ProjectionsService,
    private vectorClockService: VectorClockService,
    private crdtService: CRDTService,
    private conflictService: ConflictResolutionService,
  ) {}

  async push(dto: PushSyncDto): Promise<PushSyncResponseDto> {
    const accepted: AcceptedEventDto[] = [];
    const rejected: RejectedEventDto[] = [];
    const conflicted: ConflictedEventDto[] = [];
    let lastProcessedSeq = 0;

    if (!dto.events || dto.events.length === 0) {
      return {
        accepted: [],
        rejected: [],
        conflicted: [],
        server_time: Date.now(),
        last_processed_seq: 0,
      };
    }

    // 1. Verificar dedupe: obtener event_ids que ya existen
    const eventIds = dto.events.map((e) => e.event_id).filter(Boolean);
    const existingEvents = await this.eventRepository.find({
      where: { event_id: In(eventIds) },
      select: ['event_id'],
    });
    const existingEventIds = new Set(existingEvents.map((e) => e.event_id));

    const eventsToSave: Event[] = [];

    // 2. Procesar cada evento
    for (const event of dto.events) {
      try {
        // 2a. Validación básica
        if (!this.isEventValid(event)) {
          rejected.push({
            event_id: event.event_id || 'unknown',
            seq: event.seq,
            code: 'VALIDATION_ERROR',
            message:
              'Evento inválido: campos requeridos faltantes (event_id, type, payload, actor)',
          });
          continue;
        }

        // 2b. Validar tipo conocido
        if (!this.knownEventTypes.includes(event.type)) {
          rejected.push({
            event_id: event.event_id,
            seq: event.seq,
            code: 'VALIDATION_ERROR',
            message: `Tipo de evento desconocido: ${event.type}`,
          });
          continue;
        }

        // 2c. Dedupe por event_id (idempotencia)
        if (existingEventIds.has(event.event_id)) {
          accepted.push({
            event_id: event.event_id,
            seq: event.seq,
          });
          if (event.seq > lastProcessedSeq) {
            lastProcessedSeq = event.seq;
          }
          continue; // Evento ya existe, no se reprocesa
        }

        // 3. Procesar vector clock
        const eventVectorClock =
          event.vector_clock ||
          this.vectorClockService.fromEvent(dto.device_id, event.seq);

        // 4. Detectar y resolver conflictos
        const conflictResult = await this.detectAndResolveConflicts(
          dto.store_id,
          event,
          eventVectorClock,
          dto.device_id,
        );

        if (conflictResult.hasConflict && !conflictResult.resolved) {
          // Conflicto no resuelto, requiere intervención manual
          conflicted.push({
            event_id: event.event_id,
            seq: event.seq,
            conflict_id: conflictResult.conflictId || 'unknown',
            reason: conflictResult.reason || 'concurrent_update',
            requires_manual_review: true,
            conflicting_with: conflictResult.conflictingWith || [],
          });
          continue; // No guardar evento en conflicto
        }

        // 5. Calcular hash del payload completo
        const fullPayloadHash = this.hashPayload(
          event.delta_payload || event.payload,
        );

        // 6. Crear entidad Event para persistencia
        const eventEntity = this.eventRepository.create({
          event_id: event.event_id,
          store_id: dto.store_id,
          device_id: dto.device_id,
          seq: event.seq,
          type: event.type,
          version: event.version,
          created_at: new Date(event.created_at),
          actor_user_id: event.actor.user_id,
          actor_role: event.actor.role,
          payload: conflictResult.resolvedPayload || event.payload,
          received_at: new Date(),
          // ===== OFFLINE-FIRST FIELDS =====
          vector_clock: eventVectorClock,
          causal_dependencies: event.causal_dependencies || [],
          conflict_status: conflictResult.hasConflict ? 'auto_resolved' : 'resolved',
          delta_payload: event.delta_payload || null,
          full_payload_hash: fullPayloadHash,
        });

        eventsToSave.push(eventEntity);

        accepted.push({
          event_id: event.event_id,
          seq: event.seq,
        });

        if (event.seq > lastProcessedSeq) {
          lastProcessedSeq = event.seq;
        }
      } catch (error) {
        this.logger.error(
          `Error procesando evento ${event.event_id}`,
          error instanceof Error ? error.stack : String(error),
        );

        rejected.push({
          event_id: event.event_id,
          seq: event.seq,
          code: 'PROCESSING_ERROR',
          message:
            error instanceof Error ? error.message : 'Error procesando evento',
        });
      }
    }

    // 7. Guardar todos los eventos nuevos en batch
    if (eventsToSave.length > 0) {
      await this.eventRepository.save(eventsToSave);

      // 8. Proyectar eventos a read models
      for (const event of eventsToSave) {
        try {
          await this.projectionsService.projectEvent(event);
        } catch (error) {
          // Log error pero no fallar el sync
          this.logger.error(
            `Error proyectando evento ${event.event_id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    // 9. Log de métricas
    this.logger.log(
      `Sync completed: ${accepted.length} accepted, ${rejected.length} rejected, ${conflicted.length} conflicted`,
    );

    return {
      accepted,
      rejected,
      conflicted,
      server_time: Date.now(),
      last_processed_seq: lastProcessedSeq,
    };
  }

  /**
   * Detecta y resuelve conflictos para un evento
   */
  private async detectAndResolveConflicts(
    storeId: string,
    event: any,
    eventVectorClock: Record<string, number>,
    deviceId: string,
  ): Promise<{
    hasConflict: boolean;
    resolved: boolean;
    resolvedPayload?: any;
    conflictId?: string;
    reason?: string;
    conflictingWith?: string[];
  }> {
    // 1. Obtener entidad afectada por el evento
    const entityType = this.getEntityType(event.type);
    const entityId = this.getEntityId(event.payload);

    if (!entityId) {
      // No hay entity_id, no puede haber conflicto
      return { hasConflict: false, resolved: true };
    }

    // 2. Buscar eventos existentes para la misma entidad
    const existingEvents = await this.findEventsForEntity(
      storeId,
      entityType,
      entityId,
    );

    if (existingEvents.length === 0) {
      // No hay eventos previos, no puede haber conflicto
      return { hasConflict: false, resolved: true };
    }

    // 3. Comparar con cada evento existente
    for (const existing of existingEvents) {
      const detection = this.conflictService.detectConflict(
        {
          vector_clock: existing.vector_clock,
          entity_type: entityType,
          entity_id: entityId,
        },
        {
          vector_clock: eventVectorClock,
          entity_type: entityType,
          entity_id: entityId,
        },
      );

      if (detection.hasConflict) {
        this.logger.warn(
          `Conflict detected: ${event.event_id} vs ${existing.event_id}`,
        );

        // 4. Intentar resolver automáticamente
        const resolution = await this.conflictService.resolveConflict(
          [
            {
              event_id: existing.event_id,
              payload: existing.payload,
              timestamp: existing.created_at.getTime(),
              device_id: existing.device_id,
              vector_clock: existing.vector_clock,
            },
            {
              event_id: event.event_id,
              payload: event.payload,
              timestamp: event.created_at,
              device_id: deviceId,
              vector_clock: eventVectorClock,
            },
          ],
          detection.strategy,
        );

        if (resolution.resolved) {
          this.logger.log(
            `Conflict auto-resolved using ${resolution.strategy}`,
          );
          return {
            hasConflict: true,
            resolved: true,
            resolvedPayload: resolution.resolvedValue,
          };
        } else {
          // No se pudo resolver automáticamente
          return {
            hasConflict: true,
            resolved: false,
            conflictId: resolution.conflictId,
            reason: 'concurrent_update_unresolved',
            conflictingWith: [existing.event_id],
          };
        }
      }
    }

    // No se encontraron conflictos
    return { hasConflict: false, resolved: true };
  }

  /**
   * Busca eventos existentes para una entidad específica
   */
  private async findEventsForEntity(
    storeId: string,
    entityType: string,
    entityId: string,
  ): Promise<Event[]> {
    // Query parametrizada para evitar SQL injection
    const query = `
      SELECT *
      FROM events
      WHERE store_id = $1
        AND type LIKE $2
        AND (
          payload->>'product_id' = $3
          OR payload->>'sale_id' = $3
          OR payload->>'customer_id' = $3
          OR payload->>'debt_id' = $3
          OR payload->>'session_id' = $3
        )
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const results = await this.eventRepository.query(query, [
      storeId,
      `${entityType}%`,
      entityId,
    ]);

    return results.map((row: any) => {
      const event = new Event();
      Object.assign(event, row);
      return event;
    });
  }

  /**
   * Extrae el tipo de entidad desde el tipo de evento
   * Ejemplo: ProductCreated → product
   */
  private getEntityType(eventType: string): string {
    const match = eventType.match(/^([A-Z][a-z]+)/);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  /**
   * Extrae el ID de entidad desde el payload
   */
  private getEntityId(payload: any): string | null {
    return (
      payload.product_id ||
      payload.sale_id ||
      payload.customer_id ||
      payload.debt_id ||
      payload.session_id ||
      null
    );
  }

  /**
   * Valida que un evento tenga los campos requeridos
   */
  private isEventValid(event: any): boolean {
    return (
      event.event_id &&
      event.type &&
      event.payload &&
      event.actor &&
      event.actor.user_id &&
      event.actor.role
    );
  }

  /**
   * Calcula hash SHA-256 de un payload
   */
  private hashPayload(payload: any): string {
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  // ===== MÉTODOS EXISTENTES (sin cambios) =====

  async getSyncStatus(
    storeId: string,
    deviceId: string,
  ): Promise<SyncStatusDto> {
    const lastEvent = await this.eventRepository.findOne({
      where: { store_id: storeId, device_id: deviceId },
      order: { seq: 'DESC' },
      select: ['seq', 'received_at'],
    });

    return {
      store_id: storeId,
      device_id: deviceId,
      last_synced_at: lastEvent?.received_at || null,
      last_event_seq: lastEvent?.seq || 0,
      pending_events_count: 0,
      last_sync_duration_ms: null,
      last_sync_error: null,
    };
  }

  async getLastProcessedSeq(
    storeId: string,
    deviceId: string,
  ): Promise<number> {
    const lastEvent = await this.eventRepository.findOne({
      where: { store_id: storeId, device_id: deviceId },
      order: { seq: 'DESC' },
      select: ['seq'],
    });

    return lastEvent?.seq || 0;
  }
}
