import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Event } from '../database/entities/event.entity';
import { InventoryEscrowService } from '../inventory/escrow/inventory-escrow.service';
import axios from 'axios';
import { createHash } from 'crypto';

import { CircuitBreaker } from '../common/circuit-breaker';
import { DistributedLockService } from '../common/distributed-lock.service';
import { ConflictAuditService } from './conflict-audit.service';

const RELAXED_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYSTEM_ACTOR_UUID = '00000000-0000-0000-0000-000000000002'; // Matches syntheticRelayActorId

function ensureUuid(id: string | null | undefined): string {
  if (!id || !RELAXED_UUID_REGEX.test(id)) {
    return SYSTEM_ACTOR_UUID;
  }
  return id;
}

export interface FederationRelayJob {
  eventId: string;
  storeId: string;
  deviceId: string;
}

export interface FederationStatus {
  enabled: boolean;
  remoteUrl: string | null;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
  remoteProbe:
  | {
    ok: boolean;
    latencyMs: number;
    statusCode: number;
  }
  | {
    ok: false;
    latencyMs: number;
    error: string;
  }
  | null;
  lastRelayError: {
    eventId: string;
    message: string;
    at: string;
  } | null;
}

export interface FederationReplayResult {
  requested: number;
  found: number;
  queued: number;
  missingSaleIds?: string[];
  missingIds?: string[];
}

export interface FederationReplayInventoryResult {
  requestedMovementIds: number;
  requestedProductIds: number;
  found: number;
  queued: number;
  missingMovementIds: string[];
}

export interface FederationIdsResult {
  total: number;
  ids: string[];
}

interface SyntheticRelayEvent {
  event_id: string;
  seq: number;
  type: string;
  version: number;
  created_at: number;
  actor: {
    user_id: string;
    role: 'owner' | 'cashier';
  };
  payload: Record<string, unknown>;
  vector_clock: Record<string, number>;
  causal_dependencies: string[];
  delta_payload: Record<string, unknown>;
  full_payload_hash: string;
}

interface SyntheticPushResult {
  acceptedEventIds: string[];
  rejected: number;
  conflicted: number;
}

export interface FederationAutoReconcileResult {
  storeId: string;
  sessions?: {
    remoteMissingCount: number;
    localMissingCount: number;
    replayedToRemote: number;
    replayedToLocal: number;
  };
  sales: {
    remoteMissingCount: number;
    localMissingCount: number;
    replayedToRemote: number;
    replayedToLocal: number;
  };
  inventory: {
    remoteMissingCount: number;
    localMissingCount: number;
    replayedToRemote: number;
    replayedToLocal: number;
    localStockHealed: number;
    remoteStockHealed: number;
  };
  debts?: {
    remoteMissingCount: number;
    localMissingCount: number;
    replayedToRemote: number;
    replayedToLocal: number;
  };
  voids?: {
    remoteMissingCount: number;
    localMissingCount: number;
    replayedToRemote: number;
    replayedToLocal: number;
  };
  skipped?: boolean;
  reason?: string;
}

export interface InventoryStockReconcileResult {
  ok: boolean;
  message: string;
  patchedNullWarehouse: number;
  updatedRows: number;
  insertedRows: number;
  zeroedRows: number;
}

@Injectable()
export class FederationSyncService implements OnModuleInit {
  private readonly logger = new Logger(FederationSyncService.name);
  private readonly remoteUrl: string | undefined;
  private readonly adminKey: string | undefined;
  private readonly syntheticRelayDeviceId =
    '00000000-0000-0000-0000-000000000001';
  private readonly syntheticRelayActorId =
    '00000000-0000-0000-0000-000000000002';
  private lastRelayError: {
    eventId: string;
    message: string;
    at: string;
  } | null = null;
  private autoReconcileInFlight = false;
  private circuitBreaker = new CircuitBreaker();

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectQueue('federation-sync')
    private syncQueue: Queue,
    private configService: ConfigService,
    private dataSource: DataSource,
    private moduleRef: ModuleRef,
    private lockService: DistributedLockService,
    private conflictAudit: ConflictAuditService,
  ) {
    this.remoteUrl = this.configService.get<string>('REMOTE_SYNC_URL');
    this.adminKey = this.configService.get<string>('ADMIN_SECRET');
  }

  private get inventoryEscrowService(): InventoryEscrowService {
    return this.moduleRef.get(InventoryEscrowService, { strict: false });
  }

  async onModuleInit() {
    if (this.remoteUrl) {
      this.logger.log(`🌐 Federation Sync ENABLED to: ${this.remoteUrl}`);
    } else {
      this.logger.log('🌐 Federation Sync DISABLED (REMOTE_SYNC_URL not set)');
    }

    // Optional bootstrap reconcile to self-heal gaps after restarts/outages.
    const bootstrapEnabled = this.configService
      .get<string>('FEDERATION_BOOTSTRAP_RECONCILE_ENABLED')
      ?.toLowerCase();
    if (bootstrapEnabled !== 'false') {
      const delayMs = Number(
        this.configService.get<string>(
          'FEDERATION_BOOTSTRAP_RECONCILE_DELAY_MS',
        ) || 20000,
      );
      setTimeout(
        () => {
          this.runAutoReconcile().catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Bootstrap auto-reconcile failed: ${msg}`);
          });
        },
        Math.max(0, delayMs),
      );
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoReconcileCron() {
    const enabled = this.configService.get<string>(
      'FEDERATION_AUTO_RECONCILE_ENABLED',
    );
    if (enabled?.toLowerCase() === 'false') return;
    await this.runAutoReconcile();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async autoReclaimEscrowCron() {
    const storeIds = await this.getKnownStoreIds();
    for (const storeId of storeIds) {
      try {
        await this.inventoryEscrowService.reclaimExpiredQuotas(storeId);
      } catch (error) {
        this.logger.error(
          `Failed to reclaim escrow for store ${storeId}: ${error.message}`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedRelayJobsCron() {
    const enabled = this.configService.get<string>(
      'FEDERATION_RETRY_FAILED_ENABLED',
    );
    if (enabled?.toLowerCase() === 'false') return;

    const maxJobs = Number(
      this.configService.get<string>('FEDERATION_RETRY_FAILED_MAX_JOBS') || 200,
    );
    if (maxJobs <= 0) return;

    const failedJobs = await this.syncQueue.getFailed(0, maxJobs - 1);
    if (failedJobs.length === 0) return;

    let retried = 0;
    for (const job of failedJobs) {
      try {
        await job.retry();
        retried += 1;
      } catch {
        // If retry is not possible for a specific job, continue.
      }
    }

    if (retried > 0) {
      this.logger.log(`♻️ Retried ${retried} failed federation relay jobs`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async smartAutoHealCron() {
    const enabled = this.configService.get<string>(
      'FEDERATION_SMART_AUTO_HEAL_ENABLED',
    );
    if (enabled?.toLowerCase() === 'false') return;
    if (this.autoReconcileInFlight) return;

    const waitingThreshold = Number(
      this.configService.get<string>('FEDERATION_HEAL_WAITING_THRESHOLD') ||
      100,
    );
    const failedThreshold = Number(
      this.configService.get<string>('FEDERATION_HEAL_FAILED_THRESHOLD') || 1,
    );

    const [waiting, failed] = await Promise.all([
      this.syncQueue.getWaitingCount(),
      this.syncQueue.getFailedCount(),
    ]);

    if (failed >= failedThreshold || waiting >= waitingThreshold) {
      this.logger.warn(
        `🛠️ Smart auto-heal triggered (waiting=${waiting}, failed=${failed})`,
      );
      await this.runAutoReconcile();
    }
  }

  /**
   * Encola un evento para ser retransmitido al servidor remoto
   */
  private getRelayPriority(eventType: string): number {
    const priorities: Record<string, number> = {
      CashSessionOpened: 1,
      CashSessionClosed: 2,
      ProductCreated: 3,
      ProductUpdated: 3,
      CustomerCreated: 3,
      CustomerUpdated: 3,
      DebtCreated: 4,
      SaleCreated: 5,
      StockReceived: 5,
      StockAdjusted: 5,
      StockDeltaApplied: 5,
      DebtPaymentRecorded: 6,
      DebtPaymentAdded: 6,
      SaleVoided: 7,
      CashLedgerEntryCreated: 8,
    };
    return priorities[eventType] ?? 10;
  }

  /**
   * Encola un evento para ser retransmitido al servidor remoto
   */
  async queueRelay(event: Event) {
    if (!this.remoteUrl) return;

    const queuesEnabled =
      process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
      process.env.QUEUES_DISABLED?.toLowerCase() !== 'true';

    if (!queuesEnabled) {
      await this.relayEventNow(event);
      return;
    }

    try {
      // Utilizar event_id como jobId para asegurar idempotencia en BullMQ.
      // Si el job ya existe, Bull lo ignorará, logrando "exactly-once" per device.
      const jobId = `relay-${event.event_id}`;

      await this.syncQueue.add(
        'relay-event',
        {
          eventId: event.event_id,
          storeId: event.store_id,
          deviceId: event.device_id,
        },
        {
          jobId,
          priority: this.getRelayPriority(event.type),
          attempts: 10,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: { age: 3600, count: 5000 },
          removeOnFail: { age: 86400 },
        },
      );
      this.logger.debug(
        `Evento ${event.event_id} encolado para relay (JobId: ${jobId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error encolando relay para evento ${event.event_id}:`,
        error,
      );
    }
  }

  private async relayEventNow(event: Event) {
    if (!this.remoteUrl) return;

    try {
      this.logger.debug(
        `Relaying event ${event.type} (${event.event_id}) to ${this.remoteUrl}...`,
      );

      const payload = {
        store_id: event.store_id,
        device_id: event.device_id,
        client_version: 'federation-relay-1.0',
        events: [
          {
            event_id: event.event_id,
            seq: Number(event.seq),
            type: event.type,
            version: event.version,
            created_at: event.created_at.getTime(),
            actor: {
              user_id: ensureUuid(event.actor_user_id),
              role: event.actor_role as 'owner' | 'cashier',
            },
            payload: event.payload,
            vector_clock: event.vector_clock,
            causal_dependencies: event.causal_dependencies,
            delta_payload: event.delta_payload,
            full_payload_hash: event.full_payload_hash,
          },
        ],
      };

      await this.circuitBreaker.execute(() =>
        axios.post(`${this.remoteUrl}/sync/push`, payload, {
          headers: {
            Authorization: `Bearer ${this.adminKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }),
      );

      this.logger.log(`✅ Event ${event.event_id} relayed successfully.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to relay event ${event.event_id}: ${msg}`);
      this.registerRelayError(event.event_id, msg);
    }
  }

  registerRelayError(eventId: string, message: string) {
    this.lastRelayError = {
      eventId,
      message,
      at: new Date().toISOString(),
    };
  }

  private async probeRemote(): Promise<FederationStatus['remoteProbe']> {
    if (!this.remoteUrl) return null;

    const start = Date.now();
    try {
      const response = await axios.get(`${this.remoteUrl}/ping`, {
        timeout: 3000,
        validateStatus: () => true,
      });
      return {
        ok: response.status >= 200 && response.status < 500,
        latencyMs: Date.now() - start,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getFederationStatus(): Promise<FederationStatus> {
    const [waiting, active, delayed, completed, failed, remoteProbe] =
      await Promise.all([
        this.syncQueue.getWaitingCount(),
        this.syncQueue.getActiveCount(),
        this.syncQueue.getDelayedCount(),
        this.syncQueue.getCompletedCount(),
        this.syncQueue.getFailedCount(),
        this.probeRemote(),
      ]);

    return {
      enabled: Boolean(this.remoteUrl),
      remoteUrl: this.remoteUrl || null,
      circuitBreakerState: this.circuitBreaker.getStatus(),
      queue: {
        waiting,
        active,
        delayed,
        completed,
        failed,
      },
      remoteProbe,
      lastRelayError: this.lastRelayError,
    };
  }

  async replaySalesByIds(
    storeId: string,
    saleIds: string[],
  ): Promise<FederationReplayResult> {
    const uniqueSaleIds = Array.from(
      new Set(saleIds.map((id) => id?.trim()).filter(Boolean)),
    );

    if (!this.remoteUrl || uniqueSaleIds.length === 0) {
      return {
        requested: uniqueSaleIds.length,
        found: 0,
        queued: 0,
        missingSaleIds: uniqueSaleIds,
      };
    }

    const rows = await this.dataSource.query(
      `
            SELECT event_id, payload->>'sale_id' AS sale_id
            FROM events
            WHERE store_id = $1
              AND type IN ('SaleCreated', 'SaleVoided')
              AND payload->>'sale_id' = ANY($2)
            `,
      [storeId, uniqueSaleIds],
    );

    const foundSaleIds = new Set<string>(
      rows.map((row: { sale_id: string }) => row.sale_id),
    );
    let missingSaleIds = uniqueSaleIds.filter(
      (saleId) => !foundSaleIds.has(saleId),
    );

    let queued = 0;
    for (const row of rows as Array<{ event_id: string }>) {
      const event = await this.eventRepository.findOne({
        where: { event_id: row.event_id },
      });
      if (!event) {
        this.logger.error(
          `Event ${row.event_id} found in query but not in repository!`,
        );
        continue;
      }
      await this.queueRelay(event);
      queued += 1;
    }

    if (missingSaleIds.length > 0) {
      this.logger.warn(
        `Missing SaleCreated events for sale_ids: ${missingSaleIds.join(', ')}. Attempting synthetic replay.`,
      );

      // Fetch full sale data including items
      const saleRows = await this.dataSource
        .getRepository('Sale')
        .createQueryBuilder('sale')
        .leftJoinAndSelect('sale.items', 'items')
        .where('sale.store_id = :storeId', { storeId })
        .andWhere('sale.id IN (:...ids)', { ids: missingSaleIds })
        .getMany();

      if (saleRows.length > 0) {
        const syntheticEvents = saleRows.map((row) =>
          this.buildSyntheticSaleCreatedEvent(storeId, row),
        );
        const eventToSaleId = new Map(
          syntheticEvents.map((event, idx) => [
            event.event_id,
            String(saleRows[idx].id),
          ]),
        );

        try {
          const pushResult = await this.pushSyntheticEvents(
            storeId,
            syntheticEvents,
          );
          const replayedSaleIds = new Set(
            pushResult.acceptedEventIds
              .map((eventId) => eventToSaleId.get(eventId))
              .filter((value): value is string => Boolean(value)),
          );

          queued += replayedSaleIds.size;
          missingSaleIds = missingSaleIds.filter(
            (id) => !replayedSaleIds.has(id),
          );

          if (pushResult.rejected > 0 || pushResult.conflicted > 0) {
            this.logger.warn(
              `Sale synthetic replay had rejects/conflicts for store ${storeId}: rejected=${pushResult.rejected}, conflicted=${pushResult.conflicted}`,
            );
          } else {
            this.logger.log(
              `✅ Sale synthetic replay success: ${replayedSaleIds.size} sales pushed synthetically.`,
            );
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Sale synthetic replay failed for store ${storeId}: ${msg}`,
          );
        }
      }
    }

    this.logger.log(
      `🔁 Federation replay queued ${queued}/${uniqueSaleIds.length} SaleCreated events (found ${rows.length} real, synthesized ${queued - rows.length
      })`,
    );

    return {
      requested: uniqueSaleIds.length,
      found: rows.length,
      queued,
      missingSaleIds,
    };
  }

  async replayDebtsByIds(
    storeId: string,
    debtIds: string[],
  ): Promise<FederationReplayResult> {
    const uniqueDebtIds = Array.from(
      new Set(debtIds.map((id) => id?.trim()).filter(Boolean)),
    );

    if (!this.remoteUrl || uniqueDebtIds.length === 0) {
      return {
        requested: uniqueDebtIds.length,
        found: 0,
        queued: 0,
        missingIds: uniqueDebtIds,
      };
    }

    const rows = await this.dataSource.query(
      `
            SELECT event_id, payload->>'debt_id' AS debt_id
            FROM events
            WHERE store_id = $1
              AND type = 'DebtCreated'
              AND payload->>'debt_id' = ANY($2)
            `,
      [storeId, uniqueDebtIds],
    );

    const foundIds = new Set<string>(
      rows.map((row: { debt_id: string }) => row.debt_id),
    );
    let missingIds = uniqueDebtIds.filter((id) => !foundIds.has(id));

    let queued = 0;
    for (const row of rows as Array<{ event_id: string }>) {
      const event = await this.eventRepository.findOne({
        where: { event_id: row.event_id },
      });
      if (!event) continue;
      await this.queueRelay(event);
      queued += 1;
    }

    if (missingIds.length > 0) {
      const debtRows = await this.dataSource.query(
        `
          SELECT id, sale_id, customer_id, created_at, amount_bs, amount_usd, note
          FROM debts
          WHERE store_id = $1
            AND id = ANY($2)
        `,
        [storeId, missingIds],
      );

      if (debtRows.length > 0) {
        const syntheticEvents = (debtRows as Array<Record<string, unknown>>).map(
          (row) => this.buildSyntheticDebtCreatedEvent(storeId, row),
        );
        const eventToDebtId = new Map(
          syntheticEvents.map((event, idx) => [
            event.event_id,
            String(debtRows[idx].id),
          ]),
        );

        try {
          const pushResult = await this.pushSyntheticEvents(
            storeId,
            syntheticEvents,
          );
          const replayedDebtIds = new Set(
            pushResult.acceptedEventIds
              .map((eventId) => eventToDebtId.get(eventId))
              .filter((value): value is string => Boolean(value)),
          );

          queued += replayedDebtIds.size;
          missingIds = missingIds.filter((id) => !replayedDebtIds.has(id));

          if (pushResult.rejected > 0 || pushResult.conflicted > 0) {
            this.logger.warn(
              `Debt synthetic replay had rejects/conflicts for store ${storeId}: rejected=${pushResult.rejected}, conflicted=${pushResult.conflicted}`,
            );
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Debt synthetic replay failed for store ${storeId}: ${msg}`,
          );
        }
      }
    }

    return {
      requested: uniqueDebtIds.length,
      found: rows.length,
      queued,
      missingIds,
    };
  }

  async replayDebtPaymentsByIds(
    storeId: string,
    paymentIds: string[],
  ): Promise<FederationReplayResult> {
    const uniquePaymentIds = Array.from(
      new Set(paymentIds.map((id) => id?.trim()).filter(Boolean)),
    );

    if (!this.remoteUrl || uniquePaymentIds.length === 0) {
      return {
        requested: uniquePaymentIds.length,
        found: 0,
        queued: 0,
        missingIds: uniquePaymentIds,
      };
    }

    const rows = await this.dataSource.query(
      `
            SELECT event_id, payload->>'payment_id' AS payment_id
            FROM events
            WHERE store_id = $1
              AND type = 'DebtPaymentRecorded'
              AND payload->>'payment_id' = ANY($2)
            `,
      [storeId, uniquePaymentIds],
    );

    const foundIds = new Set<string>(
      rows.map((row: { payment_id: string }) => row.payment_id),
    );
    let missingIds = uniquePaymentIds.filter((id) => !foundIds.has(id));

    const synthesizeFallbackIds = new Set<string>();
    let queued = 0;
    for (const row of rows as Array<{ event_id: string; payment_id: string }>) {
      const event = await this.eventRepository.findOne({
        where: { event_id: row.event_id },
      });
      if (!event) {
        synthesizeFallbackIds.add(row.payment_id);
        continue;
      }
      if (!this.isDebtPaymentRelayEventValid(event)) {
        // Evento legacy/corrupto: forzar replay sintético para evitar rechazos
        // de integridad por full_payload_hash inconsistente.
        synthesizeFallbackIds.add(row.payment_id);
        continue;
      }
      await this.queueRelay(event);
      queued += 1;
    }
    missingIds = Array.from(new Set([...missingIds, ...synthesizeFallbackIds]));

    if (missingIds.length > 0) {
      const paymentRows = await this.dataSource.query(
        `
          SELECT id, debt_id, amount_bs, amount_usd, method, paid_at, note
          FROM debt_payments
          WHERE store_id = $1
            AND id = ANY($2)
        `,
        [storeId, missingIds],
      );

      if (paymentRows.length > 0) {
        const syntheticEvents = (
          paymentRows as Array<Record<string, unknown>>
        ).map((row) => this.buildSyntheticDebtPaymentEvent(storeId, row));
        const eventToPaymentId = new Map(
          syntheticEvents.map((event, idx) => [
            event.event_id,
            String(paymentRows[idx].id),
          ]),
        );

        try {
          const pushResult = await this.pushSyntheticEvents(
            storeId,
            syntheticEvents,
          );
          const replayedPaymentIds = new Set(
            pushResult.acceptedEventIds
              .map((eventId) => eventToPaymentId.get(eventId))
              .filter((value): value is string => Boolean(value)),
          );

          queued += replayedPaymentIds.size;
          missingIds = missingIds.filter((id) => !replayedPaymentIds.has(id));

          if (pushResult.rejected > 0 || pushResult.conflicted > 0) {
            this.logger.warn(
              `Debt payment synthetic replay had rejects/conflicts for store ${storeId}: rejected=${pushResult.rejected}, conflicted=${pushResult.conflicted}`,
            );
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Debt payment synthetic replay failed for store ${storeId}: ${msg}`,
          );
        }
      }
    }

    return {
      requested: uniquePaymentIds.length,
      found: rows.length,
      queued,
      missingIds,
    };
  }

  async replaySessionsByIds(
    storeId: string,
    sessionIds: string[],
  ): Promise<FederationReplayResult> {
    const uniqueSessionIds = Array.from(
      new Set(sessionIds.map((id) => id?.trim()).filter(Boolean)),
    );

    if (!this.remoteUrl || uniqueSessionIds.length === 0) {
      return {
        requested: uniqueSessionIds.length,
        found: 0,
        queued: 0,
        missingSaleIds: uniqueSessionIds, // Reutilizamos DTO
      };
    }

    const rows = await this.dataSource.query(
      `
            SELECT event_id, payload->>'session_id' AS session_id
            FROM events
            WHERE store_id = $1
              AND type IN ('CashSessionOpened', 'CashSessionClosed')
              AND payload->>'session_id' = ANY($2)
            `,
      [storeId, uniqueSessionIds],
    );

    const foundSessionIds = new Set<string>(
      rows.map((row: { session_id: string }) => row.session_id),
    );
    const missingSessionIds = uniqueSessionIds.filter(
      (sessionId) => !foundSessionIds.has(sessionId),
    );

    let queued = 0;
    for (const row of rows as Array<{ event_id: string }>) {
      const event = await this.eventRepository.findOne({
        where: { event_id: row.event_id },
      });
      if (!event) continue;
      await this.queueRelay(event);
      queued += 1;
    }

    this.logger.log(
      `🔁 Federation replay queued ${queued}/${uniqueSessionIds.length} Session events (found ${rows.length})`,
    );

    return {
      requested: uniqueSessionIds.length,
      found: rows.length,
      queued,
      missingSaleIds: missingSessionIds,
    };
  }

  async replayInventoryByFilter(
    storeId: string,
    movementIds: string[],
    productIds: string[],
  ): Promise<FederationReplayInventoryResult> {
    const uniqueMovementIds = Array.from(
      new Set(movementIds.map((id) => id?.trim()).filter(Boolean)),
    );
    const uniqueProductIds = Array.from(
      new Set(productIds.map((id) => id?.trim()).filter(Boolean)),
    );

    if (
      !this.remoteUrl ||
      (uniqueMovementIds.length === 0 && uniqueProductIds.length === 0)
    ) {
      return {
        requestedMovementIds: uniqueMovementIds.length,
        requestedProductIds: uniqueProductIds.length,
        found: 0,
        queued: 0,
        missingMovementIds: uniqueMovementIds,
      };
    }

    let query = `
            SELECT event_id, payload->>'movement_id' AS movement_id, payload->>'product_id' AS product_id
            FROM events
            WHERE store_id = $1
              AND type IN ('StockReceived', 'StockAdjusted', 'StockDeltaApplied')
        `;
    const params: unknown[] = [storeId];
    const filters: string[] = [];

    if (uniqueMovementIds.length > 0) {
      params.push(uniqueMovementIds);
      filters.push(`payload->>'movement_id' = ANY($${params.length})`);
    }
    if (uniqueProductIds.length > 0) {
      params.push(uniqueProductIds);
      filters.push(`payload->>'product_id' = ANY($${params.length})`);
    }

    if (filters.length > 0) {
      query += ` AND (${filters.join(' OR ')})`;
    }

    query += ' ORDER BY created_at ASC';

    const rows = await this.dataSource.query(query, params);
    const foundMovementIds = new Set<string>(
      rows
        .map((row: { movement_id: string | null }) => row.movement_id)
        .filter(Boolean),
    );

    const missingMovementIds = uniqueMovementIds.filter(
      (movementId) => !foundMovementIds.has(movementId),
    );

    let queued = 0;
    for (const row of rows as Array<{ event_id: string }>) {
      const event = await this.eventRepository.findOne({
        where: { event_id: row.event_id },
      });
      if (!event) continue;
      await this.queueRelay(event);
      queued += 1;
    }

    this.logger.log(
      `🔁 Federation inventory replay queued ${queued} events (found=${rows.length})`,
    );

    return {
      requestedMovementIds: uniqueMovementIds.length,
      requestedProductIds: uniqueProductIds.length,
      found: rows.length,
      queued,
      missingMovementIds,
    };
  }

  async getSalesIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
            SELECT COUNT(1)::int AS total
            FROM sales
            WHERE store_id = $1
              AND sold_at >= $2::date
              AND sold_at < ($3::date + interval '1 day')
            `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
            SELECT id
            FROM sales
            WHERE store_id = $1
              AND sold_at >= $2::date
              AND sold_at < ($3::date + interval '1 day')
            ORDER BY sold_at DESC
            LIMIT $4 OFFSET $5
            `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getSessionIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
            SELECT COUNT(1)::int AS total
            FROM cash_sessions
            WHERE store_id = $1
              AND opened_at >= $2::date
              AND opened_at < ($3::date + interval '1 day')
            `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
            SELECT id
            FROM cash_sessions
            WHERE store_id = $1
              AND opened_at >= $2::date
              AND opened_at < ($3::date + interval '1 day')
            ORDER BY opened_at DESC
            LIMIT $4 OFFSET $5
            `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getInventoryMovementIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
            SELECT COUNT(1)::int AS total
            FROM events
            WHERE store_id = $1
              AND type IN ('StockReceived', 'StockAdjusted', 'StockDeltaApplied')
              AND created_at >= $2::date
              AND created_at < ($3::date + interval '1 day')
              AND payload->>'movement_id' IS NOT NULL
            `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
            SELECT DISTINCT payload->>'movement_id' AS movement_id
            FROM events
            WHERE store_id = $1
              AND type IN ('StockReceived', 'StockAdjusted', 'StockDeltaApplied')
              AND created_at >= $2::date
              AND created_at < ($3::date + interval '1 day')
              AND payload->>'movement_id' IS NOT NULL
            ORDER BY movement_id ASC
            LIMIT $4 OFFSET $5
            `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { movement_id: string }) => row.movement_id),
    };
  }

  async getDebtIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
            SELECT COUNT(1)::int AS total
            FROM debts
            WHERE store_id = $1
              AND created_at >= $2::date
              AND created_at < ($3::date + interval '1 day')
            `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
            SELECT id
            FROM debts
            WHERE store_id = $1
              AND created_at >= $2::date
              AND created_at < ($3::date + interval '1 day')
            ORDER BY created_at DESC
            LIMIT $4 OFFSET $5
            `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getDebtPaymentIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
            SELECT COUNT(1)::int AS total
            FROM debt_payments
            WHERE store_id = $1
              AND paid_at >= $2::date
              AND paid_at < ($3::date + interval '1 day')
            `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
            SELECT id
            FROM debt_payments
            WHERE store_id = $1
              AND paid_at >= $2::date
              AND paid_at < ($3::date + interval '1 day')
            ORDER BY paid_at DESC
            LIMIT $4 OFFSET $5
            `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getVoidedSalesIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
            SELECT COUNT(1)::int AS total
            FROM sales
            WHERE store_id = $1
              AND voided_at IS NOT NULL
              AND sold_at >= $2::date
              AND sold_at < ($3::date + interval '1 day')
            `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
            SELECT id
            FROM sales
            WHERE store_id = $1
              AND voided_at IS NOT NULL
              AND sold_at >= $2::date
              AND sold_at < ($3::date + interval '1 day')
            ORDER BY sold_at DESC
            LIMIT $4 OFFSET $5
            `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async runAutoReconcile(
    storeId?: string,
  ): Promise<FederationAutoReconcileResult[]> {
    // Use distributed lock to prevent concurrent reconciliation
    return this.lockService.withLock(
      'federation:auto-reconcile',
      async () => {
        if (this.autoReconcileInFlight) {
          return [
            {
              storeId: storeId || 'all',
              sales: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
              },
              inventory: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
                localStockHealed: 0,
                remoteStockHealed: 0,
              },
              debts: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
              },
              voids: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
              },
              skipped: true,
              reason: 'auto-reconcile already in flight',
            },
          ];
        }

        if (!this.remoteUrl || !this.adminKey) {
          return [
            {
              storeId: storeId || 'all',
              sales: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
              },
              inventory: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
                localStockHealed: 0,
                remoteStockHealed: 0,
              },
              debts: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
              },
              voids: {
                remoteMissingCount: 0,
                localMissingCount: 0,
                replayedToRemote: 0,
                replayedToLocal: 0,
              },
              skipped: true,
              reason: 'federation not configured',
            },
          ];
        }

        this.autoReconcileInFlight = true;
        try {
          const targetStoreIds = storeId
            ? [storeId]
            : await this.getKnownStoreIds();
          const results: FederationAutoReconcileResult[] = [];
          for (const currentStoreId of targetStoreIds) {
            try {
              results.push(await this.reconcileStore(currentStoreId));
            } catch (error) {
              const reason =
                error instanceof Error ? error.message : String(error);
              this.logger.warn(
                `Auto-reconcile skipped for ${currentStoreId}: ${reason}`,
              );
              results.push({
                storeId: currentStoreId,
                sessions: {
                  remoteMissingCount: 0,
                  localMissingCount: 0,
                  replayedToRemote: 0,
                  replayedToLocal: 0,
                },
                sales: {
                  remoteMissingCount: 0,
                  localMissingCount: 0,
                  replayedToRemote: 0,
                  replayedToLocal: 0,
                },
                inventory: {
                  remoteMissingCount: 0,
                  localMissingCount: 0,
                  replayedToRemote: 0,
                  replayedToLocal: 0,
                  localStockHealed: 0,
                  remoteStockHealed: 0,
                },
                debts: {
                  remoteMissingCount: 0,
                  localMissingCount: 0,
                  replayedToRemote: 0,
                  replayedToLocal: 0,
                },
                voids: {
                  remoteMissingCount: 0,
                  localMissingCount: 0,
                  replayedToRemote: 0,
                  replayedToLocal: 0,
                },
                skipped: true,
                reason,
              });
            }
          }
          return results;
        } finally {
          this.autoReconcileInFlight = false;
        }
      },
      { timeoutMs: 10000, ttlMs: 120000 }, // 10s timeout, 2min TTL
    );
  }

  private async getKnownStoreIds(): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT id FROM stores ORDER BY created_at DESC LIMIT 50`,
    );
    return rows.map((row: { id: string }) => row.id);
  }

  // --- EVENT BASED RECONCILIATION METHODS ---

  async getSalesEventIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT payload->>'sale_id')::int AS total
      FROM events
      WHERE store_id = $1
        AND type = 'SaleCreated'
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'sale_id' IS NOT NULL
    `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT payload->>'sale_id' AS id
      FROM events
      WHERE store_id = $1
        AND type = 'SaleCreated'
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'sale_id' IS NOT NULL
      ORDER BY id
      LIMIT $4 OFFSET $5
    `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getDebtEventIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT payload->>'debt_id')::int AS total
      FROM events
      WHERE store_id = $1
        AND type = 'DebtCreated'
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'debt_id' IS NOT NULL
    `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT payload->>'debt_id' AS id
      FROM events
      WHERE store_id = $1
        AND type = 'DebtCreated'
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'debt_id' IS NOT NULL
      ORDER BY id
      LIMIT $4 OFFSET $5
    `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getDebtPaymentEventIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT payload->>'payment_id')::int AS total
      FROM events
      WHERE store_id = $1
        AND type IN ('DebtPaymentRecorded', 'DebtPaymentAdded')
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'payment_id' IS NOT NULL
    `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT payload->>'payment_id' AS id
      FROM events
      WHERE store_id = $1
        AND type IN ('DebtPaymentRecorded', 'DebtPaymentAdded')
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'payment_id' IS NOT NULL
      ORDER BY id
      LIMIT $4 OFFSET $5
    `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getSessionEventIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT payload->>'session_id')::int AS total
      FROM events
      WHERE store_id = $1
        AND type IN ('CashSessionOpened', 'CashSessionClosed')
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'session_id' IS NOT NULL
    `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT payload->>'session_id' AS id
      FROM events
      WHERE store_id = $1
        AND type IN ('CashSessionOpened', 'CashSessionClosed')
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'session_id' IS NOT NULL
      ORDER BY id
      LIMIT $4 OFFSET $5
    `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getVoidedSalesEventIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT payload->>'sale_id')::int AS total
      FROM events
      WHERE store_id = $1
        AND type = 'SaleVoided'
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'sale_id' IS NOT NULL
    `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT payload->>'sale_id' AS id
      FROM events
      WHERE store_id = $1
        AND type = 'SaleVoided'
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'sale_id' IS NOT NULL
      ORDER BY id
      LIMIT $4 OFFSET $5
    `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  async getInventoryMovementEventIds(
    storeId: string,
    dateFrom: string,
    dateTo: string,
    limit = 10000,
    offset = 0,
  ): Promise<FederationIdsResult> {
    const totalRows = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT payload->>'movement_id')::int AS total
      FROM events
      WHERE store_id = $1
        AND type IN ('StockReceived', 'StockAdjusted', 'StockDeltaApplied')
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'movement_id' IS NOT NULL
    `,
      [storeId, dateFrom, dateTo],
    );

    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT payload->>'movement_id' AS id
      FROM events
      WHERE store_id = $1
        AND type IN ('StockReceived', 'StockAdjusted', 'StockDeltaApplied')
        AND created_at >= $2::date
        AND created_at < ($3::date + interval '1 day')
        AND payload->>'movement_id' IS NOT NULL
      ORDER BY id
      LIMIT $4 OFFSET $5
    `,
      [storeId, dateFrom, dateTo, limit, offset],
    );

    return {
      total: Number(totalRows?.[0]?.total || 0),
      ids: rows.map((row: { id: string }) => row.id),
    };
  }

  private async reconcileStore(
    storeId: string,
  ): Promise<FederationAutoReconcileResult> {
    const days = Number(
      this.configService.get<string>('FEDERATION_RECONCILE_DAYS') || 30,
    );
    // Asymmetric throttling: outbound (Local→Cloud) stays controlled,
    // inbound (Cloud→Local) is unlimited for powerful local hardware.
    const maxBatchOutbound = Number(
      this.configService.get<string>('FEDERATION_RECONCILE_MAX_BATCH_OUTBOUND') ||
      this.configService.get<string>('FEDERATION_RECONCILE_MAX_BATCH') ||
      500,
    );
    const maxBatchInbound = Number(
      this.configService.get<string>('FEDERATION_RECONCILE_MAX_BATCH_INBOUND') ||
      10000,
    );
    const now = new Date();
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const dateFrom = fromDate.toISOString().slice(0, 10);
    const dateTo = now.toISOString().slice(0, 10);

    this.logger.log(
      `🔄 Reconcile ${storeId}: outbound batch=${maxBatchOutbound}, inbound batch=${maxBatchInbound}`,
    );

    // Paso 1: Autocorrección local/remota de snapshot de inventario antes de comparar IDs.
    const localPreHeal = await this.reconcileInventoryStock(storeId);
    const remotePreHeal = await this.postRemoteStockReconcile(storeId).catch(
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Remote pre-heal failed for ${storeId}: ${msg}`);
        return null;
      },
    );

    // Use table-based IDs (not event-based) so local comparison matches
    // the same source the remote endpoint exposes. This avoids phantom diffs
    // for records that exist in domain tables but lack SaleCreated/etc. events.
    const [
      localSales,
      localInventory,
      localSessions,
      localDebts,
      localDebtPayments,
      localVoids,
    ] = await Promise.all([
      this.getSalesIds(storeId, dateFrom, dateTo),
      this.getInventoryMovementIds(storeId, dateFrom, dateTo),
      this.getSessionIds(storeId, dateFrom, dateTo),
      this.getDebtIds(storeId, dateFrom, dateTo),
      this.getDebtPaymentIds(storeId, dateFrom, dateTo),
      this.getVoidedSalesIds(storeId, dateFrom, dateTo),
    ]);

    const [
      remoteSales,
      remoteInventory,
      remoteSessions,
      remoteDebts,
      remoteDebtPayments,
      remoteVoids,
    ] = await Promise.all([
      this.fetchRemoteIds(
        '/sync/federation/sales-ids',
        storeId,
        dateFrom,
        dateTo,
      ),
      this.fetchRemoteIds(
        '/sync/federation/inventory-movement-ids',
        storeId,
        dateFrom,
        dateTo,
      ),
      this.fetchRemoteIds(
        '/sync/federation/session-ids',
        storeId,
        dateFrom,
        dateTo,
      ),
      this.fetchRemoteIds(
        '/sync/federation/debt-ids',
        storeId,
        dateFrom,
        dateTo,
      ),
      this.fetchRemoteIds(
        '/sync/federation/debt-payment-ids',
        storeId,
        dateFrom,
        dateTo,
      ),
      this.fetchRemoteIds(
        '/sync/federation/voided-sales-ids',
        storeId,
        dateFrom,
        dateTo,
      ),
    ]);

    // Sessions diff
    const sessionsMissingInRemote = this.diff(
      localSessions.ids,
      remoteSessions.ids,
    );
    const sessionsMissingInLocal = this.diff(
      remoteSessions.ids,
      localSessions.ids,
    );

    // Sales diff
    const salesMissingInRemote = this.diff(localSales.ids, remoteSales.ids);
    const salesMissingInLocal = this.diff(remoteSales.ids, localSales.ids);

    // Inventory diff
    const invMissingInRemote = this.diff(
      localInventory.ids,
      remoteInventory.ids,
    );
    const invMissingInLocal = this.diff(
      remoteInventory.ids,
      localInventory.ids,
    );

    // Debts diff
    const debtsMissingInRemote = this.diff(localDebts.ids, remoteDebts.ids);
    const debtsMissingInLocal = this.diff(remoteDebts.ids, localDebts.ids);

    // Debt Payments diff
    const paymentsMissingInRemote = this.diff(
      localDebtPayments.ids,
      remoteDebtPayments.ids,
    );
    const paymentsMissingInLocal = this.diff(
      remoteDebtPayments.ids,
      localDebtPayments.ids,
    );

    // Voided Sales diff (Status bidirectional)
    const voidsMissingInRemote = this.diff(localVoids.ids, remoteVoids.ids);
    const voidsMissingInLocal = this.diff(remoteVoids.ids, localVoids.ids);

    // Outbound (Local → Cloud): controlled batch to protect cloud resources
    const replaySessionsToRemote = sessionsMissingInRemote.slice(0, maxBatchOutbound);
    const replaySalesToRemote = salesMissingInRemote.slice(0, maxBatchOutbound);
    const replayInvToRemote = invMissingInRemote.slice(0, maxBatchOutbound);
    const replayDebtsToRemote = debtsMissingInRemote.slice(0, maxBatchOutbound);
    const replayPaymentsToRemote = paymentsMissingInRemote.slice(0, maxBatchOutbound);
    const replayVoidsToRemote = voidsMissingInRemote.slice(0, maxBatchOutbound);

    // Inbound (Cloud → Local): unlimited batch — local hardware can handle it
    const replaySessionsToLocal = sessionsMissingInLocal.slice(0, maxBatchInbound);
    const replaySalesToLocal = salesMissingInLocal.slice(0, maxBatchInbound);
    const replayInvToLocal = invMissingInLocal.slice(0, maxBatchInbound);
    const replayDebtsToLocal = debtsMissingInLocal.slice(0, maxBatchInbound);
    const replayPaymentsToLocal = paymentsMissingInLocal.slice(0, maxBatchInbound);
    const replayVoidsToLocal = voidsMissingInLocal.slice(0, maxBatchInbound);

    // PASO 2: Replicar sesiones (Local -> Remote) primero para dependencias
    const [sessionsToRemoteResult] = await Promise.all([
      replaySessionsToRemote.length > 0
        ? this.replaySessionsByIds(storeId, replaySessionsToRemote)
        : Promise.resolve({ queued: 0 }),
    ]);

    // PASO 3: Replicar ventas y anulaciones (Local -> Remote)
    // CRITICAL: Sales MUST be synced before Debts to avoid FK violations (400 Bad Request)
    const [salesToRemoteResult, voidsToRemoteResult] = await Promise.all([
      replaySalesToRemote.length > 0
        ? this.replaySalesByIds(storeId, replaySalesToRemote)
        : Promise.resolve({ queued: 0 }),
      replayVoidsToRemote.length > 0
        ? this.replaySalesByIds(storeId, replayVoidsToRemote) // Reusamos replaySalesByIds ya que maneja SaleVoided
        : Promise.resolve({ queued: 0 }),
    ]);

    // PASO 4: Replicar deudas e inventario (Local -> Remote)
    // Ahora es seguro enviar deudas porque las ventas ya existen en el remoto
    const [debtsToRemoteResult, invToRemoteResult] = await Promise.all([
      replayDebtsToRemote.length > 0
        ? this.replayDebtsByIds(storeId, replayDebtsToRemote)
        : Promise.resolve({ queued: 0 }),
      replayInvToRemote.length > 0
        ? this.replayInventoryByFilter(storeId, replayInvToRemote, [])
        : Promise.resolve({ queued: 0 }),
    ]);

    // Replicar pagos de deuda después de las deudas
    const [paymentsToRemoteResult] = await Promise.all([
      replayPaymentsToRemote.length > 0
        ? this.replayDebtPaymentsByIds(storeId, replayPaymentsToRemote)
        : Promise.resolve({ queued: 0 }),
    ]);

    // PASO 5: Pedir repetición remota (Remote -> Local)
    if (replaySessionsToLocal.length > 0) {
      await this.postRemoteReplay('/sync/federation/replay-sessions', {
        store_id: storeId,
        session_ids: replaySessionsToLocal,
      });
    }

    if (replayDebtsToLocal.length > 0) {
      await this.postRemoteReplay('/sync/federation/replay-debts', {
        store_id: storeId,
        debt_ids: replayDebtsToLocal,
      });
    }

    if (replaySalesToLocal.length > 0) {
      await this.postRemoteReplay('/sync/federation/replay-sales', {
        store_id: storeId,
        sale_ids: replaySalesToLocal,
      });
    }

    if (replayPaymentsToLocal.length > 0) {
      await this.postRemoteReplay('/sync/federation/replay-debt-payments', {
        store_id: storeId,
        payment_ids: replayPaymentsToLocal,
      });
    }

    if (replayInvToLocal.length > 0) {
      await this.postRemoteReplay('/sync/federation/replay-inventory', {
        store_id: storeId,
        movement_ids: replayInvToLocal,
      });
    }

    // Bidirectional voids: Si el remoto tiene anulaciones que yo no tengo localmente
    if (replayVoidsToLocal.length > 0) {
      await this.postRemoteReplay('/sync/federation/replay-sales', {
        store_id: storeId,
        sale_ids: replayVoidsToLocal,
      });
    }

    // Paso 6: Re-ejecutar autocorrección luego de replicar eventos.
    const localPostHeal = await this.reconcileInventoryStock(storeId);
    const remotePostHeal = await this.postRemoteStockReconcile(storeId).catch(
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Remote post-heal failed for ${storeId}: ${msg}`);
        return null;
      },
    );

    const localStockHealed =
      this.sumHealedRows(localPreHeal) + this.sumHealedRows(localPostHeal);
    const remoteStockHealed =
      this.sumHealedRows(remotePreHeal) + this.sumHealedRows(remotePostHeal);

    const result: FederationAutoReconcileResult = {
      storeId,
      sessions: {
        remoteMissingCount: sessionsMissingInRemote.length,
        localMissingCount: sessionsMissingInLocal.length,
        replayedToRemote: Number(
          (sessionsToRemoteResult as { queued: number }).queued || 0,
        ),
        replayedToLocal: replaySessionsToLocal.length,
      },
      sales: {
        remoteMissingCount: salesMissingInRemote.length,
        localMissingCount: salesMissingInLocal.length,
        replayedToRemote: Number(
          (salesToRemoteResult as { queued: number }).queued || 0,
        ),
        replayedToLocal: replaySalesToLocal.length,
      },
      inventory: {
        remoteMissingCount: invMissingInRemote.length,
        localMissingCount: invMissingInLocal.length,
        replayedToRemote: Number(
          (invToRemoteResult as { queued: number }).queued || 0,
        ),
        replayedToLocal: replayInvToLocal.length,
        localStockHealed,
        remoteStockHealed,
      },
      debts: {
        remoteMissingCount:
          debtsMissingInRemote.length + paymentsMissingInRemote.length,
        localMissingCount:
          debtsMissingInLocal.length + paymentsMissingInLocal.length,
        replayedToRemote:
          Number((debtsToRemoteResult as { queued: number }).queued || 0) +
          Number((paymentsToRemoteResult as { queued: number }).queued || 0),
        replayedToLocal:
          replayDebtsToLocal.length + replayPaymentsToLocal.length,
      },
      voids: {
        remoteMissingCount: voidsMissingInRemote.length,
        localMissingCount: voidsMissingInLocal.length,
        replayedToRemote: Number(
          (voidsToRemoteResult as { queued: number }).queued || 0,
        ),
        replayedToLocal: replayVoidsToLocal.length,
      },
    };

    this.logger.log(
      `🧭 Reconcile store ${storeId}: sales(rem=${result.sales.remoteMissingCount}, loc=${result.sales.localMissingCount}), debts(rem=${result.debts!.remoteMissingCount}, loc=${result.debts!.localMissingCount}), inventory(rem=${result.inventory.remoteMissingCount}, loc=${result.inventory.localMissingCount}, healedLocal=${localStockHealed})`,
    );
    return result;
  }

  private diff(source: string[], target: string[]): string[] {
    const targetSet = new Set(target);
    return source.filter((id) => !targetSet.has(id));
  }

  private buildSyntheticSaleCreatedEvent(
    storeId: string,
    row: any,
  ): SyntheticRelayEvent {
    // Generamos un event_id determinista usando el ID de la venta
    const uniqueString = `${storeId}:${row.id}:SaleCreated:synthetic`;
    const eventId = createHash('sha256')
      .update(uniqueString)
      .digest('hex')
      .substring(0, 36); // Truncar para formato UUID aunque no sea válido std

    return {
      event_id: ensureUuid(eventId), // Aseguramos formato UUID válido
      seq: 0, // Synthetic sequence usually 0 or irrelevant for relay
      type: 'SaleCreated',
      version: 1,
      created_at: new Date(row.created_at).getTime(),
      actor: {
        user_id: ensureUuid(row.sold_by_user_id),
        role: 'cashier', // Default fallback role
      },
      payload: {
        matches: [], // Synthetic doesn't have match detail
        payment: row.payment,
        sale_id: row.id,
        sold_at: row.sold_at,
        currency: row.currency,
        items: row.items || [], // Assuming items are hydrated in the query or joined
        store_id: storeId,
        payments: [], // Legacy field if needed
        sale_number: Number(row.sale_number),
        total_price: Number(row.totals.total_usd), // Canonical total often used
        customer_id: row.customer_id ? String(row.customer_id) : null,
        total_price_bs: Number(row.totals.total_bs),
        exchange_rate_bs: Number(row.exchange_rate),
      },
      vector_clock: {},
      causal_dependencies: [],
      delta_payload: {},
      full_payload_hash: 'synthetic',
    };
  }

  private buildSyntheticDebtCreatedEvent(
    storeId: string,
    row: Record<string, unknown>,
  ): SyntheticRelayEvent {
    const createdAt = new Date(String(row.created_at));
    const seq = createdAt.getTime();
    const payload = {
      debt_id: String(row.id),
      sale_id: row.sale_id ? String(row.sale_id) : null,
      customer_id: row.customer_id ? String(row.customer_id) : null,
      created_at: createdAt.toISOString(),
      amount_bs: Number(row.amount_bs || 0),
      amount_usd: Number(row.amount_usd || 0),
      note: row.note ? String(row.note) : null,
    };
    const vectorClock = { [this.syntheticRelayDeviceId]: seq };

    return {
      event_id: this.deterministicUuid(
        `federation:synthetic:debt-created:${storeId}:${payload.debt_id}`,
      ),
      seq,
      type: 'DebtCreated',
      version: 1,
      created_at: seq,
      actor: {
        user_id: this.syntheticRelayActorId,
        role: 'owner',
      },
      payload,
      vector_clock: vectorClock,
      causal_dependencies: [],
      delta_payload: payload,
      full_payload_hash: this.hashPayload(payload),
    };
  }

  private buildSyntheticDebtPaymentEvent(
    storeId: string,
    row: Record<string, unknown>,
  ): SyntheticRelayEvent {
    const paidAt = new Date(String(row.paid_at));
    const seq = paidAt.getTime();
    const payload = {
      payment_id: String(row.id),
      debt_id: row.debt_id ? String(row.debt_id) : null,
      amount_bs: Number(row.amount_bs || 0),
      amount_usd: Number(row.amount_usd || 0),
      method: String(row.method || 'cash'),
      paid_at: paidAt.toISOString(),
      note: row.note ? String(row.note) : null,
    };
    const vectorClock = { [this.syntheticRelayDeviceId]: seq };

    return {
      event_id: this.deterministicUuid(
        `federation:synthetic:debt-payment:${storeId}:${payload.payment_id}`,
      ),
      seq,
      type: 'DebtPaymentRecorded',
      version: 1,
      created_at: seq,
      actor: {
        user_id: this.syntheticRelayActorId,
        role: 'owner',
      },
      payload,
      vector_clock: vectorClock,
      causal_dependencies: [],
      delta_payload: payload,
      full_payload_hash: this.hashPayload(payload),
    };
  }

  private deterministicUuid(seed: string): string {
    const hash = createHash('sha256').update(seed).digest('hex');
    const variant = ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(
      16,
    );
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      `4${hash.slice(13, 16)}`,
      `${variant}${hash.slice(17, 20)}`,
      hash.slice(20, 32),
    ].join('-');
  }

  private sortDeep(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((item) => this.sortDeep(item));
    if (typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString();

    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = this.sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const normalized = JSON.stringify(this.sortDeep(payload));
    return createHash('sha256').update(normalized).digest('hex');
  }

  private isDebtPaymentRelayEventValid(event: Event): boolean {
    if (
      event.type !== 'DebtPaymentRecorded' &&
      event.type !== 'DebtPaymentAdded'
    ) {
      return true;
    }

    if (!event.full_payload_hash) {
      return false;
    }

    const deltaPayload =
      event.delta_payload &&
        typeof event.delta_payload === 'object' &&
        !Array.isArray(event.delta_payload)
        ? (event.delta_payload as Record<string, unknown>)
        : null;

    const payload =
      event.payload &&
        typeof event.payload === 'object' &&
        !Array.isArray(event.payload)
        ? (event.payload as Record<string, unknown>)
        : null;

    if (
      deltaPayload &&
      this.hashPayload(deltaPayload) === event.full_payload_hash
    ) {
      return true;
    }

    if (payload && this.hashPayload(payload) === event.full_payload_hash) {
      return true;
    }

    return false;
  }

  private async pushSyntheticEvents(
    storeId: string,
    events: SyntheticRelayEvent[],
  ): Promise<SyntheticPushResult> {
    if (!this.remoteUrl || events.length === 0) {
      return { acceptedEventIds: [], rejected: 0, conflicted: 0 };
    }

    try {
      const response = await this.circuitBreaker.execute(() =>
        axios.post(
          `${this.remoteUrl}/sync/push`,
          {
            store_id: storeId,
            device_id: this.syntheticRelayDeviceId,
            client_version: 'federation-synthetic-relay-1.0',
            events,
          },
          {
            headers: {
              Authorization: `Bearer ${this.adminKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          },
        ),
      );

      const accepted = Array.isArray(response.data?.accepted)
        ? response.data.accepted
        : [];
      const rejected = Array.isArray(response.data?.rejected)
        ? response.data.rejected.length
        : 0;
      const conflicted = Array.isArray(response.data?.conflicted)
        ? response.data.conflicted.length
        : 0;

      return {
        acceptedEventIds: accepted
          .map((item: { event_id?: string }) => item.event_id)
          .filter((id: unknown): id is string => typeof id === 'string'),
        rejected,
        conflicted,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        this.logger.error(
          `❌ Synthetic push failed (400 Bad Request) for store ${storeId}. Response: ${JSON.stringify(
            error.response.data,
          )}`,
        );
      }
      throw error;
    }
  }

  private async fetchRemoteIds(
    endpoint:
      | '/sync/federation/sales-ids'
      | '/sync/federation/inventory-movement-ids'
      | '/sync/federation/session-ids'
      | '/sync/federation/debt-ids'
      | '/sync/federation/debt-payment-ids'
      | '/sync/federation/voided-sales-ids',
    storeId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<FederationIdsResult> {
    const response = await this.circuitBreaker.execute(() =>
      axios.get(`${this.remoteUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.adminKey}`,
        },
        params: {
          store_id: storeId,
          date_from: dateFrom,
          date_to: dateTo,
          limit: 10000,
          offset: 0,
        },
        timeout: 15000,
      }),
    );
    return {
      total: Number(response.data?.total || 0),
      ids: Array.isArray(response.data?.ids) ? response.data.ids : [],
    };
  }

  private async postRemoteReplay(
    endpoint: string,
    payload: Record<string, unknown>,
  ) {
    await this.circuitBreaker.execute(() =>
      axios.post(`${this.remoteUrl}${endpoint}`, payload, {
        headers: {
          Authorization: `Bearer ${this.adminKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }),
    );
  }

  private async postRemoteStockReconcile(
    storeId: string,
  ): Promise<InventoryStockReconcileResult | null> {
    const response = await this.circuitBreaker.execute(() =>
      axios.post(
        `${this.remoteUrl}/sync/federation/reconcile-inventory-stock`,
        { store_id: storeId },
        {
          headers: {
            Authorization: `Bearer ${this.adminKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      ),
    );

    return response.data as InventoryStockReconcileResult;
  }

  private sumHealedRows(result: InventoryStockReconcileResult | null): number {
    if (!result) return 0;
    return (
      Number(result.patchedNullWarehouse || 0) +
      Number(result.updatedRows || 0) +
      Number(result.insertedRows || 0) +
      Number(result.zeroedRows || 0)
    );
  }

  async reconcileInventoryStock(
    storeId: string,
  ): Promise<InventoryStockReconcileResult> {
    const defaultWarehouseRows = await this.dataSource.query(
      `
            SELECT id
            FROM warehouses
            WHERE store_id = $1
              AND is_active = true
            ORDER BY is_default DESC, name ASC
            LIMIT 1
            `,
      [storeId],
    );

    if (!defaultWarehouseRows[0]?.id) {
      return {
        ok: false,
        message: `No active warehouse found for store ${storeId}`,
        patchedNullWarehouse: 0,
        updatedRows: 0,
        insertedRows: 0,
        zeroedRows: 0,
      };
    }

    const defaultWarehouseId = defaultWarehouseRows[0].id as string;

    return this.dataSource.transaction(async (manager) => {
      const patchedNull = await manager.query(
        `
                WITH patched AS (
                  UPDATE inventory_movements
                  SET warehouse_id = $1
                  WHERE store_id = $2
                    AND warehouse_id IS NULL
                  RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM patched
                `,
        [defaultWarehouseId, storeId],
      );
      const patchedNullWarehouse = Number(patchedNull?.[0]?.count || 0);

      const updatedRowsResult = await manager.query(
        `
                WITH expected AS (
                  SELECT
                    im.warehouse_id,
                    im.product_id,
                    im.variant_id,
                    SUM(im.qty_delta)::numeric AS expected_stock
                  FROM inventory_movements im
                  INNER JOIN warehouses w ON w.id = im.warehouse_id
                  WHERE im.warehouse_id IS NOT NULL
                    AND w.store_id = $1
                    AND im.movement_type IN ('received', 'adjust', 'sold', 'sale', 'transfer_in', 'transfer_out')
                    AND (im.from_escrow IS NULL OR im.from_escrow = false)
                  GROUP BY im.warehouse_id, im.product_id, im.variant_id
                ),
                patched AS (
                  UPDATE warehouse_stock ws
                  SET stock = GREATEST(0, expected.expected_stock), updated_at = NOW()
                  FROM expected
                  WHERE ws.warehouse_id = expected.warehouse_id
                    AND ws.product_id = expected.product_id
                    AND (
                      (expected.variant_id IS NULL AND ws.variant_id IS NULL)
                      OR (expected.variant_id IS NOT NULL AND ws.variant_id = expected.variant_id)
                    )
                    AND ws.stock IS DISTINCT FROM GREATEST(0, expected.expected_stock)
                  RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM patched
                `,
        [storeId],
      );
      const updatedRows = Number(updatedRowsResult?.[0]?.count || 0);

      const insertedRowsResult = await manager.query(
        `
                WITH expected AS (
                  SELECT
                    im.warehouse_id,
                    im.product_id,
                    im.variant_id,
                    SUM(im.qty_delta)::numeric AS expected_stock
                  FROM inventory_movements im
                  INNER JOIN warehouses w ON w.id = im.warehouse_id
                  WHERE im.warehouse_id IS NOT NULL
                    AND w.store_id = $1
                    AND im.movement_type IN ('received', 'adjust', 'sold', 'sale', 'transfer_in', 'transfer_out')
                    AND (im.from_escrow IS NULL OR im.from_escrow = false)
                  GROUP BY im.warehouse_id, im.product_id, im.variant_id
                ),
                inserted AS (
                  INSERT INTO warehouse_stock (id, warehouse_id, product_id, variant_id, stock, reserved, updated_at)
                  SELECT gen_random_uuid(), expected.warehouse_id, expected.product_id, expected.variant_id, GREATEST(0, expected.expected_stock), 0, NOW()
                  FROM expected
                  WHERE expected.expected_stock > 0
                    AND NOT EXISTS (
                      SELECT 1 FROM warehouse_stock ws
                      WHERE ws.warehouse_id = expected.warehouse_id
                        AND ws.product_id = expected.product_id
                        AND (
                          (expected.variant_id IS NULL AND ws.variant_id IS NULL)
                          OR (expected.variant_id IS NOT NULL AND ws.variant_id = expected.variant_id)
                        )
                    )
                  RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM inserted
                `,
        [storeId],
      );
      const insertedRows = Number(insertedRowsResult?.[0]?.count || 0);

      const zeroedRowsResult = await manager.query(
        `
                WITH expected AS (
                  SELECT
                    im.warehouse_id,
                    im.product_id,
                    im.variant_id
                  FROM inventory_movements im
                  INNER JOIN warehouses w ON w.id = im.warehouse_id
                  WHERE im.warehouse_id IS NOT NULL
                    AND w.store_id = $1
                    AND im.movement_type IN ('received', 'adjust', 'sold', 'sale', 'transfer_in', 'transfer_out')
                  GROUP BY im.warehouse_id, im.product_id, im.variant_id
                ),
                zeroed AS (
                  UPDATE warehouse_stock ws
                  SET stock = 0, updated_at = NOW()
                  FROM warehouses w
                  WHERE ws.warehouse_id = w.id
                    AND w.store_id = $1
                    AND ws.stock <> 0
                    AND NOT EXISTS (
                      SELECT 1
                      FROM expected
                      WHERE expected.warehouse_id = ws.warehouse_id
                        AND expected.product_id = ws.product_id
                        AND (
                          (expected.variant_id IS NULL AND ws.variant_id IS NULL)
                          OR (expected.variant_id IS NOT NULL AND ws.variant_id = expected.variant_id)
                        )
                    )
                  RETURNING 1
                )
                SELECT COUNT(*)::int AS count FROM zeroed
                `,
        [storeId],
      );
      const zeroedRows = Number(zeroedRowsResult?.[0]?.count || 0);

      const result: InventoryStockReconcileResult = {
        ok: true,
        message: `inventory stock reconciled for ${storeId}`,
        patchedNullWarehouse,
        updatedRows,
        insertedRows,
        zeroedRows,
      };
      return result;
    });
  }
}

@Processor('federation-sync')
export class FederationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(FederationSyncProcessor.name);
  private readonly remoteUrl: string;
  private readonly adminKey: string;

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private configService: ConfigService,
    private federationSyncService: FederationSyncService,
  ) {
    super();
    this.remoteUrl = this.configService.get<string>('REMOTE_SYNC_URL') || '';
    this.adminKey = this.configService.get<string>('ADMIN_SECRET') || '';
  }

  async process(job: Job<FederationRelayJob>): Promise<any> {
    if (!this.remoteUrl) return;

    const { eventId } = job.data;
    const event = await this.eventRepository.findOne({
      where: { event_id: eventId },
    });

    if (!event) {
      this.logger.warn(`Event ${eventId} not found for relay, skipping.`);
      return;
    }

    try {
      this.logger.debug(
        `Relaying event ${event.type} (${eventId}) to ${this.remoteUrl}...`,
      );

      const payload = {
        store_id: event.store_id,
        device_id: event.device_id,
        client_version: 'federation-relay-1.0',
        events: [
          {
            event_id: event.event_id,
            seq: Number(event.seq),
            type: event.type,
            version: event.version,
            created_at: event.created_at.getTime(),
            actor: {
              user_id: ensureUuid(event.actor_user_id),
              role: event.actor_role as 'owner' | 'cashier',
            },
            payload: event.payload,
            vector_clock: event.vector_clock,
            causal_dependencies: event.causal_dependencies,
            delta_payload: event.delta_payload,
            full_payload_hash: event.full_payload_hash,
          },
        ],
      };

      await axios.post(`${this.remoteUrl}/sync/push`, payload, {
        headers: {
          Authorization: `Bearer ${this.adminKey}`, // Usamos admin key para bypass de validaciones si fuera necesario
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      this.logger.log(`✅ Event ${eventId} relayed successfully.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to relay event ${eventId}: ${msg}`);
      this.federationSyncService.registerRelayError(eventId, msg);
      throw error; // Re-throw for BullMQ retry
    }
  }
}
