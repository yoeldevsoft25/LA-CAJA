import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Event } from '../database/entities/event.entity';
import {
  ProjectionDependencyError,
  ProjectionsService,
} from '../projections/projections.service';
import { FederationSyncService } from './federation-sync.service';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private processing = false;
  private readonly maxRetries = 10;

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private projectionsService: ProjectionsService,
    private federationSyncService: FederationSyncService,
  ) {}

  /**
   * Escribir entradas de outbox dentro de la misma transacción
   * que los eventos.
   */
  async writeOutboxEntries(
    manager: EntityManager,
    events: Event[],
    includeFederationRelay: boolean,
  ): Promise<void> {
    const entries: any[] = [];

    for (const event of events) {
      // Siempre crear entrada para proyección
      entries.push({
        event_id: event.event_id,
        event_type: event.type,
        store_id: event.store_id,
        target: 'projection',
        status: 'pending',
      });

      // Federation relay (si no viene de federation)
      if (includeFederationRelay) {
        entries.push({
          event_id: event.event_id,
          event_type: event.type,
          store_id: event.store_id,
          target: 'federation-relay',
          status: 'pending',
        });
      }
    }

    if (entries.length > 0) {
      // Bulk insert raw query to avoid Entity overhead in critical path
      // unnest is efficient for bulk inserts in PG
      await manager.query(
        `
        INSERT INTO outbox_entries 
          (event_id, event_type, store_id, target, status, created_at)
        SELECT 
          unnest($1::text[]),
          unnest($2::text[]),
          unnest($3::uuid[]),
          unnest($4::text[]),
          'pending',
          NOW()
      `,
        [
          entries.map((e) => e.event_id),
          entries.map((e) => e.event_type),
          entries.map((e) => e.store_id),
          entries.map((e) => e.target),
        ],
      );
    }
  }

  /**
   * Processor: cada 3 segundos procesa entradas pendientes.
   * Usa FOR UPDATE SKIP LOCKED para safety multi-pod.
   */
  @Cron('*/3 * * * * *') // Cada 3 segundos
  async processOutbox() {
    if (this.processing) return;
    this.processing = true;

    try {
      await this.dataSource.transaction(async (manager) => {
        // 1. Fetch pending entries with lock
        const entries = await manager.query(`
                SELECT
                  oe.id,
                  oe.event_id,
                  oe.event_type,
                  oe.store_id,
                  oe.target,
                  oe.retry_count
                FROM outbox_entries oe
                -- events.event_id is UUID while outbox_entries.event_id is VARCHAR in current schema.
                -- Compare as text to avoid uuid=varchar operator errors across environments.
                LEFT JOIN events e ON e.event_id::text = oe.event_id
                WHERE oe.status = 'pending'
                  AND oe.retry_count < ${this.maxRetries}
                ORDER BY
                  e.created_at ASC NULLS LAST,
                  e.device_id ASC NULLS LAST,
                  e.seq ASC NULLS LAST,
                  oe.created_at ASC
                LIMIT 50
                FOR UPDATE SKIP LOCKED
              `);

        if (entries.length === 0) return;

        for (const entry of entries) {
          try {
            const event = await this.eventRepository.findOne({
              where: { event_id: entry.event_id },
            });

            if (!event) {
              this.logger.warn(
                `Event ${entry.event_id} not found for outbox entry ${entry.id}`,
              );
              // Mark as failed/dead? Or wait? For now, increment retry.
              await manager.query(
                `UPDATE outbox_entries SET retry_count = retry_count + 1, error = 'Event not found' WHERE id = $1`,
                [entry.id],
              );
              continue;
            }

            if (entry.target === 'projection') {
              await this.projectionsService.projectEvent(event);

              // Keep events.projection_status in sync when projecting from outbox.
              await manager.getRepository(Event).update(event.event_id, {
                projection_status: 'processed',
                projection_error: null,
              });
            } else if (entry.target === 'federation-relay') {
              // For Phase 1, we still use the queueing mechanism of FederationSyncService
              // but driven by the outbox processor.
              await this.federationSyncService.queueRelay(event);
            }

            // Mark as processed
            await manager.query(
              `UPDATE outbox_entries SET status = 'processed', processed_at = NOW() WHERE id = $1`,
              [entry.id],
            );
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const isDependencyError = this.isDependencyRetryable(error, msg);
            const nextRetryCount = Number(entry.retry_count) + 1;
            const reachedMaxRetries = nextRetryCount >= this.maxRetries;
            const nextStatus = reachedMaxRetries ? 'failed' : 'pending';

            this.logger.error(
              `Failed to process outbox entry ${entry.id}: ${msg}`,
            );

            if (entry.target === 'projection') {
              // Dependency errors are transient; keep event pending until max retries.
              await manager.getRepository(Event).update(entry.event_id, {
                projection_status:
                  isDependencyError && !reachedMaxRetries
                    ? 'pending'
                    : 'failed',
                projection_error: msg,
              });
            }

            await manager.query(
              `UPDATE outbox_entries
                 SET retry_count = retry_count + 1,
                     error = $2,
                     status = $3
               WHERE id = $1`,
              [entry.id, msg, nextStatus],
            );
          }
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Outbox processor error: ${msg}`);
    } finally {
      this.processing = false;
    }
  }

  private isDependencyRetryable(error: unknown, message: string): boolean {
    if (error instanceof ProjectionDependencyError) {
      return true;
    }

    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as
        | { code?: string; constraint?: string }
        | undefined;
      if (driverError?.code === '23503') {
        return true;
      }
      const constraint = driverError?.constraint ?? '';
      if (
        constraint.includes('_product_id_fkey') ||
        constraint.includes('_customer_id_fkey') ||
        constraint.includes('_debt_id_fkey') ||
        constraint.includes('_sale_id_fkey')
      ) {
        return true;
      }
    }

    return (
      message.includes('foreign key constraint') &&
      (message.includes('_product_id_fkey') ||
        message.includes('_customer_id_fkey') ||
        message.includes('_debt_id_fkey') ||
        message.includes('_sale_id_fkey'))
    );
  }
}
