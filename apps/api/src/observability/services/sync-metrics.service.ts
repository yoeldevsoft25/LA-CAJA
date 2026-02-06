import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SyncMetricsService {
  private readonly logger = new Logger(SyncMetricsService.name);

  // In a real production environment, these would be exported to Prometheus/Datadog
  // For now, we use structured logging for basic observability

  trackSyncProcessed(
    storeId: string,
    stats: {
      accepted: number;
      rejected: number;
      conflicted: number;
      durationMs: number;
    },
  ) {
    this.logger.log({
      metric: 'sync_processed',
      store_id: storeId,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }

  trackProjectionRetry(event_id: string, attempt: number, error: string) {
    this.logger.warn({
      metric: 'sync_projection_retry',
      event_id,
      attempt,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  trackProjectionFailureFatal(event_id: string, error: string, stack?: string) {
    this.logger.error({
      metric: 'sync_projection_failure_fatal',
      event_id,
      error,
      stack,
      timestamp: new Date().toISOString(),
    });
  }

  trackOutOfOrderEvent(
    event_id: string,
    entity_id: string,
    current_version: number,
    incoming_version: number,
  ) {
    this.logger.warn({
      metric: 'sync_out_of_order_ignored',
      event_id,
      entity_id,
      current_version,
      incoming_version,
      timestamp: new Date().toISOString(),
    });
  }

  trackDigestHit(storeId: string) {
    this.logger.log({
      metric: 'sync_digest_hit',
      store_id: storeId,
      timestamp: new Date().toISOString(),
    });
  }

  trackSnapshotCreated(storeId: string, entity: string, version: number) {
    this.logger.log({
      metric: 'crdt_snapshot_created',
      store_id: storeId,
      entity,
      version,
      timestamp: new Date().toISOString(),
    });
  }

  trackCrdtDrift(
    storeId: string,
    entity: string,
    entityId: string,
    snapshotHash: string,
    calcHash: string,
  ) {
    this.logger.error({
      metric: 'crdt_verify_drift',
      store_id: storeId,
      entity,
      entity_id: entityId,
      snapshot_hash: snapshotHash,
      calculated_hash: calcHash,
      timestamp: new Date().toISOString(),
    });
  }
}
