import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { ProjectionsService } from '../../projections/projections.service';
import { Event } from '../../database/entities/event.entity';
import { Sale } from '../../database/entities/sale.entity';

export interface ProjectSaleEventJob {
  event: Event;
}

/**
 * Queue Processor para proyecciones de ventas
 * Procesa proyecciones de eventos de ventas de forma asíncrona
 * para no bloquear la respuesta al cliente
 */
@Processor('sales-projections', {
  concurrency: 10, // Alta concurrencia para procesar múltiples ventas en paralelo
  limiter: {
    max: 100, // Procesar hasta 100 jobs por segundo
    duration: 1000,
  },
})
export class SalesProjectionQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SalesProjectionQueueProcessor.name);

  constructor(
    private projectionsService: ProjectionsService,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
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
      // ⚡ OPTIMIZACIÓN 2025: Early filtering - Verificar idempotencia antes de procesar
      // Esto evita trabajo innecesario si el evento ya fue procesado
      const payload = event.payload as { sale_id?: string } | null;
      if (payload?.sale_id) {
        const existingSale = await this.saleRepository.findOne({
          where: { id: payload.sale_id, store_id: event.store_id },
        });

        if (existingSale) {
          const duration = Date.now() - startTime;
          this.logger.debug(
            `⏭️ Evento ${event.event_id} ya procesado (idempotencia), saltando en ${duration}ms`,
          );
          await job.updateProgress(100);
          return; // Idempotencia temprana - evitar procesamiento innecesario
        }
      }

      // Proyectar el evento
      await this.projectionsService.projectEvent(event);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Proyección completada para evento ${event.event_id} en ${duration}ms`,
      );

      await job.updateProgress(100);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Error proyectando evento ${event.event_id} después de ${duration}ms:`,
        error instanceof Error ? error.stack : String(error),
      );

      // Re-lanzar el error para que BullMQ maneje el retry
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
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job de proyección ${job.name} (${job.id}) falló después de ${job.attemptsMade} intentos:`,
      error.message,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(
      `Job de proyección ${job.name} (${job.id}) progreso: ${progress}%`,
    );
  }
}
