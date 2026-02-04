import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { ProjectionsService } from '../../projections/projections.service';
import { Event } from '../../database/entities/event.entity';
import { Sale } from '../../database/entities/sale.entity';
import { SyncMetricsService } from '../../observability/services/sync-metrics.service';
import { SaleCreatedPayload } from '../../sync/dto/sync-types';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { Debt } from '../../database/entities/debt.entity';

export interface ProjectSaleEventJob {
  event: Event;
}

/**
 * Queue Processor para proyecciones de ventas
 * Procesa proyecciones de eventos de ventas de forma asíncrona
 * para no bloquear la respuesta al cliente
 */
@Processor('sales-projections', {
  concurrency: 100, // ☢️ TOTAL OVERLOAD: 100 Parallel Workers for Ryzen 7700X
  limiter: {
    max: 1000,
    duration: 1000,
  },
})
export class SalesProjectionQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SalesProjectionQueueProcessor.name);

  constructor(
    private readonly projectionsService: ProjectionsService,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
    @InjectRepository(Debt)
    private readonly debtRepository: Repository<Debt>,
    private readonly metricsService: SyncMetricsService,
  ) {
    super();
  }

  async process(job: Job<ProjectSaleEventJob>): Promise<void> {
    const { event } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Procesando proyección de evento ${event.type} (${event.event_id}) para store ${event.store_id}`,
    );

    try {
      // ⚡ OPTIMIZACIÓN: Early filtering - Verificar idempotencia
      const payload = event.payload as unknown as SaleCreatedPayload;
      if (payload?.sale_id) {
        const existingSale = await this.saleRepository.findOne({
          where: { id: payload.sale_id, store_id: event.store_id },
          relations: ['items'],
        });

        if (existingSale) {
          // ⚡ COMPLETENESS CHECK RIGUROSO
          let isComplete = true;
          const incompletenessReasons: string[] = [];

          // 1. Check Items
          const payloadItemsCount = Array.isArray(payload.items)
            ? payload.items.length
            : 0;
          const dbItemsCount = existingSale.items
            ? existingSale.items.length
            : 0;
          if (payloadItemsCount > 0 && dbItemsCount !== payloadItemsCount) {
            isComplete = false;
            incompletenessReasons.push(
              `Items mismatch (DB: ${dbItemsCount}, Payload: ${payloadItemsCount})`,
            );
          }

          // 2. Check Inventory Movements (Estimate based on unique items)
          if (isComplete && payloadItemsCount > 0) {
            const movementsCount = await this.movementRepository
              .createQueryBuilder('im')
              .where("im.ref->>'sale_id' = :saleId", {
                saleId: payload.sale_id,
              })
              .andWhere('im.store_id = :storeId', { storeId: event.store_id })
              .getCount();

            const expectedMovements = payload.items.length;

            if (movementsCount < expectedMovements) {
              isComplete = false;
              incompletenessReasons.push(
                `Inventory Movements missing (DB: ${movementsCount}, Expected: ${expectedMovements})`,
              );
            }
          }

          // 3. Check Debt (FIAO)
          if (isComplete && payload.payment?.method === 'FIAO') {
            const debtExists = await this.debtRepository.findOne({
              where: { sale_id: payload.sale_id, store_id: event.store_id },
              select: ['id'],
            });
            if (!debtExists) {
              isComplete = false;
              incompletenessReasons.push('Debt missing for FIAO sale');
            }
          }

          if (!isComplete) {
            this.logger.warn(
              `⚠️ Venta ${payload.sale_id} existe pero no está completa. Proyección parcial detectada. Razones: ${incompletenessReasons.join(', ')}. Re-procesando para reparar.`,
            );
            // No retornamos, dejamos que pase a projectEvent para reparar
          } else {
            this.logger.debug(
              `⏭️ Evento ${event.event_id} ya proyectado y COMPLETO, saltando.`,
            );
            await this.eventRepository.update(event.event_id, {
              projection_status: 'processed',
              projection_error: null,
            });
            return;
          }
        }
      }

      await this.projectionsService.projectEvent(event);

      // ✅ Marcar evento como procesado
      await this.eventRepository.update(event.event_id, {
        projection_status: 'processed',
        projection_error: null,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Proyección completada para evento ${event.event_id} en ${duration}ms`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `❌ Error proyectando evento ${event.event_id}: ${message}`,
        stack,
      );
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(
      `Job de proyección ${job.name} (${job.id}) completado exitosamente`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job de proyección ${job.name} (${job.id}) falló después de ${job.attemptsMade} intentos:`,
      error.message,
    );

    this.metricsService.trackProjectionRetry(
      job.data?.event?.event_id,
      job.attemptsMade,
      error.message,
    );

    const maxAttempts = job.opts.attempts || 3;
    if (job.attemptsMade >= maxAttempts) {
      this.metricsService.trackProjectionFailureFatal(
        job.data?.event?.event_id,
        error.message,
        error.stack,
      );

      // 🛑 Marcar evento como fallido definitivamente
      if (job.data?.event?.event_id) {
        await this.eventRepository.update(job.data.event.event_id, {
          projection_status: 'failed',
          projection_error: `${error.message}\n${error.stack}`.substring(
            0,
            5000,
          ),
        });
      }
    }
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(
      `Job de proyección ${job.name} (${job.id}) progreso: ${progress}%`,
    );
  }
}
