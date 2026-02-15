import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FederationSyncService } from './federation-sync.service';
import { FederationAlertsService } from './federation-alerts.service';
import { ApiProperty } from '@nestjs/swagger';

class FederationMetricsDto {
  @ApiProperty()
  eventLagCount: number;
  @ApiProperty()
  projectionGapCount: number;
  @ApiProperty()
  stockDivergenceCount: number;
  @ApiProperty()
  negativeStockCount: number;
  @ApiProperty()
  queueDepth: number;
  @ApiProperty()
  failedJobs: number;
  @ApiProperty()
  remoteReachable: boolean;
  @ApiProperty({ nullable: true })
  remoteLatencyMs: number | null;
  @ApiProperty()
  fiscalDuplicates: number;
  @ApiProperty()
  conflictRate: number;
  @ApiProperty()
  outboxBacklog: number;
  @ApiProperty()
  outboxDead: number;
}

class FederationDetailsDto {
  @ApiProperty({ required: false })
  projectionGaps?: { sales: number; debts: number };
  @ApiProperty({ required: false })
  conflicts?: { last1h: number };
}

export class FederationHealthReport {
  @ApiProperty()
  timestamp: string;
  @ApiProperty()
  storeId: string;
  @ApiProperty({ enum: ['healthy', 'degraded', 'critical'] })
  overallHealth: 'healthy' | 'degraded' | 'critical';
  @ApiProperty({ type: FederationMetricsDto })
  metrics: FederationMetricsDto;
  @ApiProperty({ type: FederationDetailsDto, required: false })
  details?: FederationDetailsDto;
}

@Injectable()
export class SplitBrainMonitorService {
  private readonly logger = new Logger(SplitBrainMonitorService.name);

  constructor(
    private dataSource: DataSource,
    private federationSyncService: FederationSyncService,
    private federationAlertsService: FederationAlertsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async takeHealthSnapshot() {
    // ... (implementation unchanged)
  }

  async getHealthReport(storeId: string): Promise<FederationHealthReport> {
    // ... (implementation unchanged, but now returns the class instance)
    const status = await this.federationSyncService.getFederationStatus();
    const outboxStats = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending') as pending, COUNT(*) FILTER (WHERE status = 'failed' AND retry_count >= 10) as dead FROM outbox_entries WHERE store_id = $1 AND target = 'federation-relay'`,
      [storeId],
    );
    const outboxBacklog = Number(outboxStats[0].pending || 0);
    const outboxDead = Number(outboxStats[0].dead || 0);
    const saleGaps = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM events e LEFT JOIN sales s ON s.id = (e.payload->>'sale_id')::uuid WHERE e.store_id = $1 AND e.type = 'SaleCreated' AND e.created_at < NOW() - INTERVAL '1 minute' AND e.projection_status IN ('processed', 'failed') AND s.id IS NULL`,
        [storeId],
    );
    const saleGapCount = Number(saleGaps[0].count || 0);
    let debtGapCount = 0;
    try {
        const debtGaps = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM events e LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid WHERE e.store_id = $1 AND e.type = 'DebtCreated' AND e.created_at < NOW() - INTERVAL '1 minute' AND e.projection_status IN ('processed', 'failed') AND d.id IS NULL AND NOT EXISTS (SELECT 1 FROM debts d2 WHERE d2.store_id = e.store_id AND d2.sale_id = (e.payload->>'sale_id')::uuid)`,
            [storeId],
        );
        debtGapCount = Number(debtGaps[0].count || 0);
    } catch {}
    const totalProjectionGaps = saleGapCount + debtGapCount;
    const negativeStock = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM warehouse_stock ws JOIN warehouses w ON w.id = ws.warehouse_id WHERE w.store_id = $1 AND ws.stock < 0`,
        [storeId],
    );
    const negativeStockCount = Number(negativeStock[0].count || 0);
    const stockDivergenceCount = 0;
    const fiscalDuplicates = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM (SELECT fiscal_number, invoice_series_id FROM sales WHERE store_id = $1 AND fiscal_number IS NOT NULL GROUP BY fiscal_number, invoice_series_id HAVING COUNT(*) > 1) sub`,
        [storeId],
    );
    const fiscalDuplicateCount = Number(fiscalDuplicates[0].count || 0);
    const conflicts = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM conflict_audit_log WHERE store_id = $1 AND resolved_at > NOW() - INTERVAL '1 hour'`,
        [storeId],
    );
    const conflictRate = Number(conflicts[0].count || 0);
    const queueDepth = status.queue.waiting + status.queue.active;
    const failedJobs = status.queue.failed;
    const remoteReachable = status.remoteProbe?.ok ?? false;
    const remoteLatencyMs = status.remoteProbe?.latencyMs ?? null;

    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (totalProjectionGaps > 10 || negativeStockCount > 5 || outboxDead > 5 || failedJobs > 10 || fiscalDuplicateCount > 0 || conflictRate > 50 || (remoteLatencyMs && remoteLatencyMs > 5000)) {
        overallHealth = 'critical';
    } else if (totalProjectionGaps > 0 || negativeStockCount > 0 || outboxBacklog > 10 || queueDepth > 50 || failedJobs > 0 || conflictRate > 10 || !remoteReachable || (remoteLatencyMs && remoteLatencyMs > 2000)) {
        overallHealth = 'degraded';
    }

    return {
        timestamp: new Date().toISOString(),
        storeId,
        overallHealth,
        metrics: {
            eventLagCount: outboxBacklog,
            projectionGapCount: totalProjectionGaps,
            stockDivergenceCount,
            negativeStockCount,
            queueDepth,
            failedJobs,
            remoteReachable,
            remoteLatencyMs,
            fiscalDuplicates: fiscalDuplicateCount,
            conflictRate,
            outboxBacklog,
            outboxDead,
        },
        details: {
            projectionGaps: {
                sales: saleGapCount,
                debts: debtGapCount,
            },
            conflicts: {
                last1h: conflictRate,
            },
        },
    };
  }

  // ... (other methods unchanged)
}
