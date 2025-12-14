import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { PushSyncDto, PushSyncResponseDto, AcceptedEventDto, RejectedEventDto } from './dto/push-sync.dto';
import { ProjectionsService } from '../projections/projections.service';
import { SyncStatusDto } from './dto/sync-status.dto';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private projectionsService: ProjectionsService,
  ) {}

  async push(dto: PushSyncDto): Promise<PushSyncResponseDto> {
    const accepted: AcceptedEventDto[] = [];
    const rejected: RejectedEventDto[] = [];
    let lastProcessedSeq = 0;

    if (!dto.events || dto.events.length === 0) {
      return {
        accepted: [],
        rejected: [],
        server_time: Date.now(),
        last_processed_seq: 0,
      };
    }

    // Verificar store_id y device_id consistentes
    for (const event of dto.events) {
      // Estos campos ya no vienen en el EventDto, sino en el PushSyncDto
      // La validación de store_id se hace en el controller contra el JWT
      // La validación de device_id se puede hacer aquí si es necesario, pero no es crítico para MVP
    }

    // Verificar dedupe: obtener event_ids que ya existen
    const eventIds = dto.events.map((e) => e.event_id).filter(Boolean);
    const existingEvents = await this.eventRepository.find({
      where: { event_id: In(eventIds) },
      select: ['event_id'],
    });
    const existingEventIds = new Set(existingEvents.map((e) => e.event_id));

    const eventsToSave: Event[] = [];

    for (const event of dto.events) {
      try {
        // Validación básica
        if (!event.event_id || !event.type || !event.payload || !event.actor || !event.actor.user_id || !event.actor.role) {
          rejected.push({
            event_id: event.event_id || 'unknown',
            seq: event.seq,
            code: 'VALIDATION_ERROR',
            message: 'Evento inválido: campos requeridos faltantes (event_id, type, payload, actor.user_id, actor.role)',
          });
          continue;
        }

        // Validar tipo de evento conocido (ejemplo, se expandirá en Sprint 8)
        const knownEventTypes = [
          'ProductCreated', 'ProductUpdated', 'ProductDeactivated', 'PriceChanged',
          'StockReceived', 'StockAdjusted', 'SaleCreated',
          'CashSessionOpened', 'CashSessionClosed',
          'CustomerCreated', 'CustomerUpdated', 'DebtCreated', 'DebtPaymentRecorded'
        ];
        if (!knownEventTypes.includes(event.type)) {
          rejected.push({
            event_id: event.event_id,
            seq: event.seq,
            code: 'VALIDATION_ERROR',
            message: `Tipo de evento desconocido: ${event.type}`,
          });
          continue;
        }

        // Dedupe por event_id
        if (existingEventIds.has(event.event_id)) {
          accepted.push({
            event_id: event.event_id,
            seq: event.seq,
          });
          if (event.seq > lastProcessedSeq) {
            lastProcessedSeq = event.seq;
          }
          continue; // Evento ya existe, lo aceptamos pero no lo reprocesamos
        }

        // Crear entidad Event para persistencia
        const eventEntity = this.eventRepository.create({
          event_id: event.event_id,
          store_id: dto.store_id, // Del DTO superior
          device_id: dto.device_id, // Del DTO superior
          seq: event.seq,
          type: event.type,
          version: event.version,
          created_at: new Date(event.created_at), // Convertir epoch ms a Date
          actor_user_id: event.actor.user_id,
          actor_role: event.actor.role,
          payload: event.payload,
          received_at: new Date(), // Se establece en el servidor
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
        rejected.push({
          event_id: event.event_id,
          seq: event.seq,
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Error procesando evento',
        });
      }
    }

    // Guardar todos los eventos nuevos en batch
    if (eventsToSave.length > 0) {
      await this.eventRepository.save(eventsToSave);

      // Proyectar eventos a read models
      for (const event of eventsToSave) {
        try {
          await this.projectionsService.projectEvent(event);
        } catch (error) {
          // Log error pero no fallar el sync
          console.error(`Error proyectando evento ${event.event_id}:`, error);
        }
      }
    }

    return {
      accepted,
      rejected,
      server_time: Date.now(),
      last_processed_seq: lastProcessedSeq,
    };
  }

  async getSyncStatus(storeId: string, deviceId: string): Promise<SyncStatusDto> {
    // Obtener último evento sincronizado de este dispositivo
    const lastEvent = await this.eventRepository.findOne({
      where: { store_id: storeId, device_id: deviceId },
      order: { seq: 'DESC' },
      select: ['seq', 'received_at'],
    });

    // Contar eventos pendientes (esto sería calculado en el cliente, pero podemos dar un estimado)
    // Por ahora, retornamos 0 ya que no hay cola en el servidor
    const pending_events_count = 0;

    return {
      store_id: storeId,
      device_id: deviceId,
      last_synced_at: lastEvent?.received_at || null,
      last_event_seq: lastEvent?.seq || 0,
      pending_events_count,
      last_sync_duration_ms: null, // Se calcularía en el cliente
      last_sync_error: null, // Se manejaría en el cliente
    };
  }

  async getLastProcessedSeq(storeId: string, deviceId: string): Promise<number> {
    const lastEvent = await this.eventRepository.findOne({
      where: { store_id: storeId, device_id: deviceId },
      order: { seq: 'DESC' },
      select: ['seq'],
    });

    return lastEvent?.seq || 0;
  }
}
