import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, In } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { Product } from '../database/entities/product.entity';
import { CashSession } from '../database/entities/cash-session.entity';
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
import { DiscountRulesService } from '../discounts/discount-rules.service';
import { UsageService } from '../licenses/usage.service';
import { SyncMetricsService } from '../observability/services/sync-metrics.service';
import { FederationSyncService } from './federation-sync.service';

interface SyncEventActor {
  user_id: string;
  role: 'owner' | 'cashier';
}

interface SyncEvent {
  event_id: string;
  seq: number;
  type: string;
  version: number;
  created_at: number;
  actor: SyncEventActor;
  payload: unknown;
}

interface SaleCreatedItemPayload {
  product_id: string;
  qty: number;
  unit_price_bs: number;
  unit_price_usd: number;
  discount_bs: number;
  discount_usd: number;
  is_weight_product?: boolean;
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;
  weight_value?: number | null;
  price_per_weight_bs?: number | null;
  price_per_weight_usd?: number | null;
}

interface SaleCreatedPayload {
  sale_id: string;
  cash_session_id: string;
  sold_at: number;
  exchange_rate: number;
  currency: string;
  items: SaleCreatedItemPayload[];
  totals: {
    subtotal_bs: number;
    subtotal_usd: number;
    discount_bs: number;
    discount_usd: number;
    total_bs: number;
    total_usd: number;
  };
  payment: {
    method: string;
    split?: Record<string, number>;
  };
  customer_id?: string;
  customer?: {
    customer_id: string | null;
  };
  note?: string;
}

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
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  // Tipos de eventos conocidos
  private readonly knownEventTypes = [
    'ProductCreated',
    'ProductUpdated',
    'ProductDeactivated',
    'PriceChanged',
    'RecipeIngredientsUpdated',
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
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(CashSession)
    private cashSessionRepository: Repository<CashSession>,
    private projectionsService: ProjectionsService,
    private vectorClockService: VectorClockService,
    private crdtService: CRDTService,
    private conflictService: ConflictResolutionService,
    private discountRulesService: DiscountRulesService,
    private usageService: UsageService,
    @InjectQueue('sales-projections')
    private salesProjectionQueue: Queue,
    private metricsService: SyncMetricsService,
    private federationSyncService: FederationSyncService,
  ) { }

  async push(
    dto: PushSyncDto,
    authenticatedUserId?: string,
  ): Promise<PushSyncResponseDto> {
    const accepted: AcceptedEventDto[] = [];
    const rejected: RejectedEventDto[] = [];
    const conflicted: ConflictedEventDto[] = [];
    let serverVectorClock: Record<string, number> = {};
    let lastProcessedSeq = 0;
    const startTime = Date.now();
    let productUsageIncrements = 0;
    let invoiceUsageIncrements = 0;

    if (!dto.events || dto.events.length === 0) {
      return {
        accepted: [],
        rejected: [],
        conflicted: [],
        server_time: Date.now(),
        last_processed_seq: 0,
        server_vector_clock: {},
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

        // ⚡ OPTIMIZACIÓN: Validaciones simplificadas para SaleCreated
        // Las validaciones pesadas se hacen en la proyección asíncrona
        if (event.type === 'SaleCreated') {
          if (
            authenticatedUserId &&
            authenticatedUserId !== 'system-federation' &&
            event.actor?.user_id &&
            event.actor.user_id !== authenticatedUserId
          ) {
            rejected.push({
              event_id: event.event_id,
              seq: event.seq,
              code: 'SECURITY_ERROR',
              message:
                'El usuario del evento no coincide con el usuario autenticado.',
            });
            continue;
          }

          const payload = event.payload as any;
          // Validación básica rápida (sin queries pesadas)
          if (
            !payload ||
            !Array.isArray(payload.items) ||
            payload.items.length === 0
          ) {
            rejected.push({
              event_id: event.event_id,
              seq: event.seq,
              code: 'VALIDATION_ERROR',
              message: 'La venta no tiene items válidos.',
            });
            continue;
          }
          if (!payload.cash_session_id) {
            rejected.push({
              event_id: event.event_id,
              seq: event.seq,
              code: 'SECURITY_ERROR',
              message: 'La venta no está asociada a una sesión de caja.',
            });
            continue;
          }
          // Validaciones pesadas se harán en la proyección asíncrona
        }

        // 2c. Dedupe por event_id (idempotencia)
        if (existingEventIds.has(event.event_id)) {
          const dedupeClock =
            event.vector_clock ||
            this.vectorClockService.fromEvent(dto.device_id, event.seq);
          serverVectorClock = this.vectorClockService.merge(
            serverVectorClock,
            dedupeClock,
          );
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

        // ⚡ OPTIMIZACIÓN: Detección de conflictos simplificada para eventos de venta
        // Para SaleCreated, los conflictos son raros y se pueden manejar en la proyección
        let conflictResult: {
          hasConflict: boolean;
          resolved: boolean;
          resolvedPayload?: any;
          conflictId?: string;
          reason?: string;
          conflictingWith?: string[];
        } = { hasConflict: false, resolved: true };
        if (event.type !== 'SaleCreated') {
          // Solo detectar conflictos para eventos que no sean ventas (más rápidos)
          conflictResult = await this.detectAndResolveConflicts(
            dto.store_id,
            event,
            eventVectorClock,
            dto.device_id,
          );
        }

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
          conflict_status: conflictResult.hasConflict
            ? 'auto_resolved'
            : 'resolved',
          delta_payload: event.delta_payload || null,
          full_payload_hash: fullPayloadHash,
        });

        eventsToSave.push(eventEntity);

        // Acumular cuotas para aplicar de forma transaccional al final
        if (event.type === 'ProductCreated') {
          productUsageIncrements++;
        } else if (event.type === 'SaleCreated') {
          invoiceUsageIncrements++;
        }

        accepted.push({
          event_id: event.event_id,
          seq: event.seq,
        });

        serverVectorClock = this.vectorClockService.merge(
          serverVectorClock,
          eventVectorClock,
        );

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
      await this.eventRepository.manager.transaction(async (manager) => {
        await manager.getRepository(Event).save(eventsToSave);

        if (productUsageIncrements > 0) {
          await this.usageService.increment(
            dto.store_id,
            'products',
            productUsageIncrements,
            manager,
          );
        }

        if (invoiceUsageIncrements > 0) {
          await this.usageService.increment(
            dto.store_id,
            'invoices_per_month',
            invoiceUsageIncrements,
            manager,
          );
        }
      });

      // 🌐 FEDERATION RELAY: Forward events to remote server
      // Avoid infinite loops by not relaying events that came from federation
      if (authenticatedUserId !== 'system-federation') {
        for (const event of eventsToSave) {
          await this.federationSyncService.queueRelay(event);
        }
      }

      // 8. Encolar proyecciones de forma asíncrona (no bloquear respuesta)
      // ⚡ OPTIMIZACIÓN 2025: Batch processing para mejor performance
      // Agrupar eventos por tipo y procesar en batches
      const saleEvents = eventsToSave.filter((e) => e.type === 'SaleCreated');
      const otherEvents = eventsToSave.filter((e) => e.type !== 'SaleCreated');

      // Batch processing para eventos de venta (más eficiente que individual)
      if (saleEvents.length > 0) {
        try {
          // Usar addBulk para encolar múltiples jobs de una vez (mejor performance)
          const jobs = saleEvents.map((event) => ({
            name: 'project-sale-event',
            data: { event },
            opts: {
              priority: 10, // Alta prioridad para ventas
              jobId: `projection-${event.event_id}`, // Evitar duplicados
              attempts: 3, // Reintentar hasta 3 veces
              backoff: {
                type: 'exponential',
                delay: 2000, // 2s, 4s, 8s
              },
              removeOnComplete: {
                age: 3600, // Mantener jobs completados por 1 hora
                count: 1000, // Mantener últimos 1000 jobs
              },
              removeOnFail: {
                age: 86400, // Mantener jobs fallidos por 24 horas para debugging
              },
            },
          }));

          await this.salesProjectionQueue.addBulk(jobs);
          this.logger.debug(
            `✅ ${saleEvents.length} proyecciones de venta encoladas en batch para procesamiento asíncrono`,
          );
        } catch (error) {
          // Fallback: encolar individualmente si addBulk falla
          this.logger.warn(
            `Error en batch processing, encolando individualmente:`,
            error instanceof Error ? error.message : String(error),
          );
          for (const event of saleEvents) {
            try {
              await this.salesProjectionQueue.add('project-sale-event', {
                event,
              });
            } catch (err) {
              this.logger.error(
                `Error encolando evento ${event.event_id}:`,
                err instanceof Error ? err.stack : String(err),
              );
            }
          }
        }
      }

      // Procesar otros eventos síncronamente (son más rápidos y no bloquean tanto)
      for (const event of otherEvents) {
        try {
          await this.projectionsService.projectEvent(event);
        } catch (error) {
          // Log error pero no fallar el sync
          this.logger.error(
            `Error procesando evento ${event.event_id}:`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // 9. Log de métricas
    this.logger.log(
      `Sync completed: ${accepted.length} accepted, ${rejected.length} rejected, ${conflicted.length} conflicted in ${durationMs}ms`,
    );

    this.metricsService.trackSyncProcessed(dto.store_id, {
      accepted: accepted.length,
      rejected: rejected.length,
      conflicted: conflicted.length,
      durationMs,
    });

    return {
      accepted,
      rejected,
      conflicted,
      server_time: Date.now(),
      last_processed_seq: lastProcessedSeq,
      server_vector_clock: serverVectorClock,
    };
  }

  private async validateSaleCreatedEvent(
    storeId: string,
    event: SyncEvent,
    authenticatedUserId?: string,
  ): Promise<{ valid: boolean; code?: string; message?: string }> {
    const payload = event.payload as SaleCreatedPayload;
    const actorUserId = event.actor?.user_id;
    const actorRole = event.actor?.role || 'cashier';

    if (
      authenticatedUserId &&
      authenticatedUserId !== 'system-federation' &&
      actorUserId &&
      actorUserId !== authenticatedUserId
    ) {
      return {
        valid: false,
        code: 'SECURITY_ERROR',
        message:
          'El usuario del evento no coincide con el usuario autenticado.',
      };
    }

    if (
      !payload ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      return {
        valid: false,
        code: 'VALIDATION_ERROR',
        message: 'La venta no tiene items válidos.',
      };
    }

    if (!payload.cash_session_id) {
      return {
        valid: false,
        code: 'SECURITY_ERROR',
        message: 'La venta no está asociada a una sesión de caja.',
      };
    }

    if (!payload.exchange_rate || Number(payload.exchange_rate) <= 0) {
      return {
        valid: false,
        code: 'VALIDATION_ERROR',
        message: 'La tasa de cambio del evento no es válida.',
      };
    }

    const session = await this.cashSessionRepository.findOne({
      where: { id: payload.cash_session_id, store_id: storeId },
    });

    if (!session || session.closed_at) {
      return {
        valid: false,
        code: 'SECURITY_ERROR',
        message: 'No hay una sesión de caja abierta para registrar la venta.',
      };
    }

    if (
      session.opened_by &&
      actorUserId &&
      session.opened_by !== actorUserId &&
      actorRole !== 'owner'
    ) {
      return {
        valid: false,
        code: 'SECURITY_ERROR',
        message:
          'El usuario del evento no tiene permisos para registrar ventas en esta sesión.',
      };
    }

    const productIds = payload.items
      .map((item) => item.product_id)
      .filter((productId): productId is string => Boolean(productId));

    const products = await this.productRepository.find({
      where: { id: In(productIds), store_id: storeId },
    });

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
    const allowedDeviation = 0.05;
    const tolerance = 0.01;
    const roundTwo = (value: number) => Math.round(value * 100) / 100;

    let computedSubtotalBs = 0;
    let computedSubtotalUsd = 0;
    let computedDiscountBs = 0;
    let computedDiscountUsd = 0;

    for (const item of payload.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return {
          valid: false,
          code: 'VALIDATION_ERROR',
          message: `Producto ${item.product_id} no encontrado.`,
        };
      }

      const isWeightProduct = Boolean(
        item.is_weight_product || product.is_weight_product,
      );
      const qty = isWeightProduct
        ? Number(item.weight_value ?? item.qty)
        : Number(item.qty);

      if (!Number.isFinite(qty) || qty <= 0) {
        return {
          valid: false,
          code: 'VALIDATION_ERROR',
          message: `Cantidad inválida para el producto ${product.name}.`,
        };
      }

      const unitPriceBs = Number(item.unit_price_bs ?? 0);
      const unitPriceUsd = Number(item.unit_price_usd ?? 0);

      if (isWeightProduct) {
        const productPriceBs = Number(product.price_per_weight_bs ?? 0);
        const productPriceUsd = Number(product.price_per_weight_usd ?? 0);

        if (productPriceBs > 0 && unitPriceBs > 0) {
          const deviationBs =
            Math.abs(unitPriceBs - productPriceBs) / productPriceBs;
          if (deviationBs > allowedDeviation && actorRole !== 'owner') {
            return {
              valid: false,
              code: 'SECURITY_ERROR',
              message: `Precio modificado sin autorización para producto ${product.name}.`,
            };
          }
        }

        if (productPriceUsd > 0 && unitPriceUsd > 0) {
          const deviationUsd =
            Math.abs(unitPriceUsd - productPriceUsd) / productPriceUsd;
          if (deviationUsd > allowedDeviation && actorRole !== 'owner') {
            return {
              valid: false,
              code: 'SECURITY_ERROR',
              message: `Precio modificado sin autorización para producto ${product.name}.`,
            };
          }
        }
      } else {
        const productPriceBs = Number(product.price_bs ?? 0);
        const productPriceUsd = Number(product.price_usd ?? 0);

        if (
          productPriceBs > 0 &&
          Math.abs(unitPriceBs - productPriceBs) > tolerance
        ) {
          return {
            valid: false,
            code: 'SECURITY_ERROR',
            message: `Precio de producto ${product.name} no coincide con el servidor.`,
          };
        }

        if (
          productPriceUsd > 0 &&
          Math.abs(unitPriceUsd - productPriceUsd) > tolerance
        ) {
          return {
            valid: false,
            code: 'SECURITY_ERROR',
            message: `Precio de producto ${product.name} no coincide con el servidor.`,
          };
        }
      }

      const lineSubtotalBs = unitPriceBs * qty;
      const lineSubtotalUsd = unitPriceUsd * qty;
      const lineDiscountBs = Number(item.discount_bs ?? 0);
      const lineDiscountUsd = Number(item.discount_usd ?? 0);

      if (lineDiscountBs < 0 || lineDiscountUsd < 0) {
        return {
          valid: false,
          code: 'VALIDATION_ERROR',
          message: `Descuento inválido para el producto ${product.name}.`,
        };
      }

      if (
        lineDiscountBs - lineSubtotalBs > tolerance ||
        lineDiscountUsd - lineSubtotalUsd > tolerance
      ) {
        return {
          valid: false,
          code: 'VALIDATION_ERROR',
          message: `Descuento excede el subtotal para el producto ${product.name}.`,
        };
      }

      computedSubtotalBs += lineSubtotalBs;
      computedSubtotalUsd += lineSubtotalUsd;
      computedDiscountBs += lineDiscountBs;
      computedDiscountUsd += lineDiscountUsd;
    }

    if (!payload.totals) {
      return {
        valid: false,
        code: 'VALIDATION_ERROR',
        message: 'La venta no tiene totales válidos.',
      };
    }

    const expectedSubtotalBs = roundTwo(computedSubtotalBs);
    const expectedSubtotalUsd = roundTwo(computedSubtotalUsd);
    const expectedDiscountBs = roundTwo(computedDiscountBs);
    const expectedDiscountUsd = roundTwo(computedDiscountUsd);
    const expectedTotalBs = roundTwo(expectedSubtotalBs - expectedDiscountBs);
    const expectedTotalUsd = roundTwo(
      expectedSubtotalUsd - expectedDiscountUsd,
    );

    if (
      Math.abs(expectedSubtotalBs - Number(payload.totals.subtotal_bs || 0)) >
      tolerance ||
      Math.abs(expectedSubtotalUsd - Number(payload.totals.subtotal_usd || 0)) >
      tolerance
    ) {
      return {
        valid: false,
        code: 'VALIDATION_ERROR',
        message: 'Los subtotales de la venta no coinciden con los items.',
      };
    }

    if (
      Math.abs(expectedDiscountBs - Number(payload.totals.discount_bs || 0)) >
      tolerance ||
      Math.abs(expectedDiscountUsd - Number(payload.totals.discount_usd || 0)) >
      tolerance
    ) {
      return {
        valid: false,
        code: 'VALIDATION_ERROR',
        message: 'Los descuentos de la venta no coinciden con los items.',
      };
    }

    if (
      Math.abs(expectedTotalBs - Number(payload.totals.total_bs || 0)) >
      tolerance ||
      Math.abs(expectedTotalUsd - Number(payload.totals.total_usd || 0)) >
      tolerance
    ) {
      return {
        valid: false,
        code: 'VALIDATION_ERROR',
        message: 'Los totales de la venta no coinciden con los items.',
      };
    }

    const discountPercentage =
      expectedSubtotalBs > 0
        ? (expectedDiscountBs / expectedSubtotalBs) * 100
        : expectedSubtotalUsd > 0
          ? (expectedDiscountUsd / expectedSubtotalUsd) * 100
          : 0;

    const discountValidation =
      await this.discountRulesService.requiresAuthorization(
        storeId,
        expectedDiscountBs,
        expectedDiscountUsd,
        discountPercentage,
      );

    if (discountValidation.error) {
      return {
        valid: false,
        code: 'SECURITY_ERROR',
        message: discountValidation.error,
      };
    }

    if (
      discountValidation.requires_authorization &&
      !discountValidation.auto_approved
    ) {
      const config = await this.discountRulesService.getOrCreateConfig(storeId);
      const canAuthorize = this.discountRulesService.validateAuthorizationRole(
        actorRole,
        config,
      );

      if (!canAuthorize) {
        return {
          valid: false,
          code: 'SECURITY_ERROR',
          message: 'El descuento requiere autorización de un supervisor.',
        };
      }
    }

    return { valid: true };
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
   * ⚡ OPTIMIZACIÓN: Usa índice GIN para búsquedas rápidas en JSONB
   */
  private async findEventsForEntity(
    storeId: string,
    entityType: string,
    entityId: string,
  ): Promise<Event[]> {
    // ⚡ OPTIMIZACIÓN: Query optimizada usando índice GIN
    // Usar @> para búsquedas más rápidas con índice GIN en lugar de ->>
    const query = `
      SELECT *
      FROM events
      WHERE store_id = $1
        AND type ILIKE $2
        AND (
          payload @> jsonb_build_object('product_id', $3::text)
          OR payload @> jsonb_build_object('sale_id', $3::text)
          OR payload @> jsonb_build_object('customer_id', $3::text)
          OR payload @> jsonb_build_object('debt_id', $3::text)
          OR payload @> jsonb_build_object('session_id', $3::text)
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

  /**
   * Obtiene eventos que ocurrieron después de un punto en el tiempo
   * Usado para replicación de datos a otros dispositivos (Pull Sync)
   */
  async pullEvents(
    storeId: string,
    since: Date,
    excludeDeviceId?: string,
    limit: number = 100,
    cursorEventId?: string,
  ): Promise<{
    events: any[];
    last_server_time: number;
    last_server_event_id: string | null;
  }> {
    const safeCursorEventId =
      cursorEventId && cursorEventId.trim().length > 0
        ? cursorEventId
        : '00000000-0000-0000-0000-000000000000';

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .where('event.store_id = :storeId', { storeId })
      .andWhere(
        '(event.received_at > :since OR (event.received_at = :since AND event.event_id > :cursorEventId))',
        { since, cursorEventId: safeCursorEventId },
      )
      .orderBy('event.received_at', 'ASC')
      .addOrderBy('event.event_id', 'ASC')
      .take(limit);

    if (excludeDeviceId) {
      qb.andWhere('event.device_id != :excludeDeviceId', { excludeDeviceId });
    }

    const events = await qb.getMany();

    const maxDate =
      events.length > 0
        ? events[events.length - 1].received_at.getTime()
        : since.getTime();

    const lastServerEventId =
      events.length > 0 ? events[events.length - 1].event_id : safeCursorEventId;

    // Mapear a formato DTO
    const dtos = events.map((e) => ({
      event_id: e.event_id,
      type: e.type,
      seq: e.seq, // Del dispositivo original
      version: e.version,
      created_at: e.created_at.getTime(),
      received_at: e.received_at.getTime(),
      actor: {
        user_id: e.actor_user_id,
        role: e.actor_role,
      },
      payload: e.payload,
      vector_clock: e.vector_clock,
    }));

    return {
      events: dtos,
      last_server_time: maxDate,
      last_server_event_id: lastServerEventId,
    };
  }
}
