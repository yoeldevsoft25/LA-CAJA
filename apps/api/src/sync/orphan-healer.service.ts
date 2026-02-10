import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Event } from '../database/entities/event.entity';
import { ProjectionsService } from '../projections/projections.service';

export interface OrphanHealResult {
  checked: number;
  healed: number;
  failed: number;
  details: Array<{
    event_id: string;
    type: string;
    status: 'healed' | 'failed';
    error?: string;
  }>;
}

@Injectable()
export class OrphanHealerService {
  private readonly logger = new Logger(OrphanHealerService.name);
  private healingInProgress = false;

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private projectionsService: ProjectionsService,
    private dataSource: DataSource,
  ) {}

  /**
   * Cada minuto, busca eventos que se guardaron
   * pero cuya proyección falló o nunca se ejecutó.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoHealCron() {
    if (this.healingInProgress) return;

    this.healingInProgress = true;
    try {
      const storeIds = await this.getActiveStoreIds();
      for (const storeId of storeIds) {
        await this.healStore(storeId);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Auto-heal failed: ${msg}`);
    } finally {
      this.healingInProgress = false;
    }
  }

  async healStore(storeId: string): Promise<OrphanHealResult> {
    const result: OrphanHealResult = {
      checked: 0,
      healed: 0,
      failed: 0,
      details: [],
    };

    // 1. Sales sin proyección
    const orphanedSales = await this.dataSource.query(
      `
      SELECT e.event_id, e.type
      FROM events e
      LEFT JOIN sales s ON s.id = (e.payload->>'sale_id')::uuid
      WHERE e.store_id = $1
        AND e.type = 'SaleCreated'
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND s.id IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `,
      [storeId],
    );

    // 2. Debts sin proyección
    const orphanedDebts = await this.dataSource.query(
      `
      SELECT e.event_id, e.type
      FROM events e
      LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
      WHERE e.store_id = $1
        AND e.type = 'DebtCreated'
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND d.id IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `,
      [storeId],
    );

    // 3. Debt payments sin proyección
    const orphanedPayments = await this.dataSource.query(
      `
      SELECT e.event_id, e.type
      FROM events e
      LEFT JOIN debt_payments dp 
        ON dp.id = (e.payload->>'payment_id')::uuid
      WHERE e.store_id = $1
        AND e.type IN ('DebtPaymentRecorded', 'DebtPaymentAdded')
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND dp.id IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `,
      [storeId],
    );

    // 4. Voided sales sin proyección
    const orphanedVoids = await this.dataSource.query(
      `
      SELECT e.event_id, e.type
      FROM events e
      INNER JOIN sales s ON s.id = (e.payload->>'sale_id')::uuid
      WHERE e.store_id = $1
        AND e.type = 'SaleVoided'
        AND e.created_at > NOW() - INTERVAL '7 days'
        AND s.voided_at IS NULL
        AND (e.projection_status IS NULL 
             OR e.projection_status != 'processed')
      ORDER BY e.created_at ASC
      LIMIT 50
    `,
      [storeId],
    );

    const allOrphans = [
      ...orphanedSales,
      ...orphanedDebts,
      ...orphanedPayments,
      ...orphanedVoids,
    ];

    result.checked = allOrphans.length;

    if (allOrphans.length === 0) return result;

    this.logger.warn(
      `🩹 Found ${allOrphans.length} orphaned projections for store ${storeId}`,
    );

    // 5. Reproyectar cada uno
    for (const orphan of allOrphans) {
      try {
        const event = await this.eventRepository.findOne({
          where: { event_id: orphan.event_id },
        });

        if (!event) {
          result.details.push({
            event_id: orphan.event_id,
            type: orphan.type,
            status: 'failed',
            error: 'Event not found in repository',
          });
          result.failed++;
          continue;
        }

        await this.projectionsService.projectEvent(event);

        await this.eventRepository.update(event.event_id, {
          projection_status: 'processed',
          projection_error: null,
        });

        result.details.push({
          event_id: orphan.event_id,
          type: orphan.type,
          status: 'healed',
        });
        result.healed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        await this.eventRepository.update(orphan.event_id, {
          projection_status: 'failed',
          projection_error: msg,
        });

        result.details.push({
          event_id: orphan.event_id,
          type: orphan.type,
          status: 'failed',
          error: msg,
        });
        result.failed++;
      }
    }

    if (result.healed > 0) {
      this.logger.log(
        `🩹 Healed ${result.healed}/${result.checked} orphaned projections ` +
          `for store ${storeId} (${result.failed} failed)`,
      );
    }

    return result;
  }

  private async getActiveStoreIds(): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT store_id FROM events 
       WHERE created_at > NOW() - INTERVAL '24 hours'
       LIMIT 50`,
    );
    return rows.map((r: { store_id: string }) => r.store_id);
  }
}
