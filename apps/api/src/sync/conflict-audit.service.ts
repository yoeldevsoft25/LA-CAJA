import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ConflictAuditEntry {
  store_id: string;
  entity_type: string;
  entity_id: string;
  winner_event_id: string;
  loser_event_ids: string[];
  strategy: string;
  winner_payload?: any;
  loser_payloads?: any;
  resolved_by?: string;
}

@Injectable()
export class ConflictAuditService {
  private readonly logger = new Logger(ConflictAuditService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Log a resolved conflict for audit purposes.
   */
  async logConflict(entry: ConflictAuditEntry): Promise<void> {
    try {
      await this.dataSource.query(
        `
        INSERT INTO conflict_audit_log (
          store_id, entity_type, entity_id,
          winner_event_id, loser_event_ids, strategy,
          winner_payload, loser_payloads, resolved_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          entry.store_id,
          entry.entity_type,
          entry.entity_id,
          entry.winner_event_id,
          entry.loser_event_ids,
          entry.strategy,
          entry.winner_payload ? JSON.stringify(entry.winner_payload) : null,
          entry.loser_payloads ? JSON.stringify(entry.loser_payloads) : null,
          entry.resolved_by || 'auto-reconcile',
        ],
      );

      this.logger.debug(
        `🛡️ Conflict audit logged for ${entry.entity_type}:${entry.entity_id} (Winner: ${entry.winner_event_id})`,
      );
    } catch (error) {
      this.logger.error('Failed to log conflict audit:', error);
      // We don't throw here to avoid failing the reconciliation process just because audit failed
    }
  }

  /**
   * Get recent conflicts for a store.
   */
  async getRecentConflicts(storeId: string, limit: number = 50) {
    return this.dataSource.query(
      `
      SELECT *
      FROM conflict_audit_log
      WHERE store_id = $1
      ORDER BY resolved_at DESC
      LIMIT $2
      `,
      [storeId, limit],
    );
  }
}
