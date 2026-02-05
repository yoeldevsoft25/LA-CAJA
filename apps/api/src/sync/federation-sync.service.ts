import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Event } from '../database/entities/event.entity';
import axios from 'axios';

export interface FederationRelayJob {
    eventId: string;
    storeId: string;
    deviceId: string;
}

export interface FederationStatus {
    enabled: boolean;
    remoteUrl: string | null;
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
    missingSaleIds: string[];
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

export interface FederationAutoReconcileResult {
    storeId: string;
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
    };
    skipped?: boolean;
    reason?: string;
}

@Injectable()
export class FederationSyncService implements OnModuleInit {
    private readonly logger = new Logger(FederationSyncService.name);
    private readonly remoteUrl: string | undefined;
    private readonly adminKey: string | undefined;
    private lastRelayError: {
        eventId: string;
        message: string;
        at: string;
    } | null = null;
    private autoReconcileInFlight = false;

    constructor(
        @InjectRepository(Event)
        private eventRepository: Repository<Event>,
        @InjectQueue('federation-sync')
        private syncQueue: Queue,
        private configService: ConfigService,
        private dataSource: DataSource,
    ) {
        this.remoteUrl = this.configService.get<string>('REMOTE_SYNC_URL');
        this.adminKey = this.configService.get<string>('ADMIN_SECRET');
    }

    async onModuleInit() {
        if (this.remoteUrl) {
            this.logger.log(`🌐 Federation Sync ENABLED to: ${this.remoteUrl}`);
        } else {
            this.logger.log('🌐 Federation Sync DISABLED (REMOTE_SYNC_URL not set)');
        }
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async autoReconcileCron() {
        const enabled = this.configService.get<string>('FEDERATION_AUTO_RECONCILE_ENABLED');
        if (enabled?.toLowerCase() === 'false') return;
        await this.runAutoReconcile();
    }

    /**
     * Encola un evento para ser retransmitido al servidor remoto
     */
    async queueRelay(event: Event) {
        if (!this.remoteUrl) return;

        await this.syncQueue.add(
            'relay-event',
            {
                eventId: event.event_id,
                storeId: event.store_id,
                deviceId: event.device_id,
            },
            {
                attempts: 10,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: true,
            },
        );
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
        const [waiting, active, delayed, completed, failed, remoteProbe] = await Promise.all([
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

    async replaySalesByIds(storeId: string, saleIds: string[]): Promise<FederationReplayResult> {
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
              AND type = 'SaleCreated'
              AND payload->>'sale_id' = ANY($2)
            `,
            [storeId, uniqueSaleIds],
        );

        const foundSaleIds = new Set<string>(rows.map((row: { sale_id: string }) => row.sale_id));
        const missingSaleIds = uniqueSaleIds.filter((saleId) => !foundSaleIds.has(saleId));

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
            `🔁 Federation replay queued ${queued}/${uniqueSaleIds.length} SaleCreated events`,
        );

        return {
            requested: uniqueSaleIds.length,
            found: rows.length,
            queued,
            missingSaleIds,
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

        if (!this.remoteUrl || (uniqueMovementIds.length === 0 && uniqueProductIds.length === 0)) {
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
              AND type IN ('StockReceived', 'StockAdjusted')
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
              AND type IN ('StockReceived', 'StockAdjusted')
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
              AND type IN ('StockReceived', 'StockAdjusted')
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

    async runAutoReconcile(storeId?: string): Promise<FederationAutoReconcileResult[]> {
        if (this.autoReconcileInFlight) {
            return [
                {
                    storeId: storeId || 'all',
                    sales: { remoteMissingCount: 0, localMissingCount: 0, replayedToRemote: 0, replayedToLocal: 0 },
                    inventory: { remoteMissingCount: 0, localMissingCount: 0, replayedToRemote: 0, replayedToLocal: 0 },
                    skipped: true,
                    reason: 'auto-reconcile already in flight',
                },
            ];
        }

        if (!this.remoteUrl || !this.adminKey) {
            return [
                {
                    storeId: storeId || 'all',
                    sales: { remoteMissingCount: 0, localMissingCount: 0, replayedToRemote: 0, replayedToLocal: 0 },
                    inventory: { remoteMissingCount: 0, localMissingCount: 0, replayedToRemote: 0, replayedToLocal: 0 },
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
                    const reason = error instanceof Error ? error.message : String(error);
                    this.logger.warn(`Auto-reconcile skipped for ${currentStoreId}: ${reason}`);
                    results.push({
                        storeId: currentStoreId,
                        sales: { remoteMissingCount: 0, localMissingCount: 0, replayedToRemote: 0, replayedToLocal: 0 },
                        inventory: { remoteMissingCount: 0, localMissingCount: 0, replayedToRemote: 0, replayedToLocal: 0 },
                        skipped: true,
                        reason,
                    });
                }
            }
            return results;
        } finally {
            this.autoReconcileInFlight = false;
        }
    }

    private async getKnownStoreIds(): Promise<string[]> {
        const rows = await this.dataSource.query(
            `SELECT id FROM stores ORDER BY created_at DESC LIMIT 50`,
        );
        return rows.map((row: { id: string }) => row.id);
    }

    private async reconcileStore(storeId: string): Promise<FederationAutoReconcileResult> {
        const days = Number(this.configService.get<string>('FEDERATION_RECONCILE_DAYS') || 30);
        const maxBatch = Number(this.configService.get<string>('FEDERATION_RECONCILE_MAX_BATCH') || 500);
        const now = new Date();
        const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const dateFrom = fromDate.toISOString().slice(0, 10);
        const dateTo = now.toISOString().slice(0, 10);

        const [localSales, localInventory] = await Promise.all([
            this.getSalesIds(storeId, dateFrom, dateTo),
            this.getInventoryMovementIds(storeId, dateFrom, dateTo),
        ]);

        const [remoteSales, remoteInventory] = await Promise.all([
            this.fetchRemoteIds('/sync/federation/sales-ids', storeId, dateFrom, dateTo),
            this.fetchRemoteIds('/sync/federation/inventory-movement-ids', storeId, dateFrom, dateTo),
        ]);

        const salesMissingInRemote = this.diff(localSales.ids, remoteSales.ids);
        const salesMissingInLocal = this.diff(remoteSales.ids, localSales.ids);
        const invMissingInRemote = this.diff(localInventory.ids, remoteInventory.ids);
        const invMissingInLocal = this.diff(remoteInventory.ids, localInventory.ids);

        const replaySalesToRemote = salesMissingInRemote.slice(0, maxBatch);
        const replaySalesToLocal = salesMissingInLocal.slice(0, maxBatch);
        const replayInvToRemote = invMissingInRemote.slice(0, maxBatch);
        const replayInvToLocal = invMissingInLocal.slice(0, maxBatch);

        const [salesToRemoteResult, invToRemoteResult] = await Promise.all([
            replaySalesToRemote.length > 0
                ? this.replaySalesByIds(storeId, replaySalesToRemote)
                : Promise.resolve({ queued: 0 }),
            replayInvToRemote.length > 0
                ? this.replayInventoryByFilter(storeId, replayInvToRemote, [])
                : Promise.resolve({ queued: 0 }),
        ]);

        if (replaySalesToLocal.length > 0) {
            await this.postRemoteReplay('/sync/federation/replay-sales', {
                store_id: storeId,
                sale_ids: replaySalesToLocal,
            });
        }
        if (replayInvToLocal.length > 0) {
            await this.postRemoteReplay('/sync/federation/replay-inventory', {
                store_id: storeId,
                movement_ids: replayInvToLocal,
            });
        }

        const result: FederationAutoReconcileResult = {
            storeId,
            sales: {
                remoteMissingCount: salesMissingInRemote.length,
                localMissingCount: salesMissingInLocal.length,
                replayedToRemote: Number((salesToRemoteResult as { queued: number }).queued || 0),
                replayedToLocal: replaySalesToLocal.length,
            },
            inventory: {
                remoteMissingCount: invMissingInRemote.length,
                localMissingCount: invMissingInLocal.length,
                replayedToRemote: Number((invToRemoteResult as { queued: number }).queued || 0),
                replayedToLocal: replayInvToLocal.length,
            },
        };

        this.logger.log(
            `🧭 Reconcile store ${storeId}: sales(remote=${result.sales.remoteMissingCount}, local=${result.sales.localMissingCount}), inventory(remote=${result.inventory.remoteMissingCount}, local=${result.inventory.localMissingCount})`,
        );
        return result;
    }

    private diff(source: string[], target: string[]): string[] {
        const targetSet = new Set(target);
        return source.filter((id) => !targetSet.has(id));
    }

    private async fetchRemoteIds(
        endpoint: '/sync/federation/sales-ids' | '/sync/federation/inventory-movement-ids',
        storeId: string,
        dateFrom: string,
        dateTo: string,
    ): Promise<FederationIdsResult> {
        const response = await axios.get(`${this.remoteUrl}${endpoint}`, {
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
        });
        return {
            total: Number(response.data?.total || 0),
            ids: Array.isArray(response.data?.ids) ? response.data.ids : [],
        };
    }

    private async postRemoteReplay(endpoint: string, payload: Record<string, unknown>) {
        await axios.post(`${this.remoteUrl}${endpoint}`, payload, {
            headers: {
                Authorization: `Bearer ${this.adminKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
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
        const event = await this.eventRepository.findOne({ where: { event_id: eventId } });

        if (!event) {
            this.logger.warn(`Event ${eventId} not found for relay, skipping.`);
            return;
        }

        try {
            this.logger.debug(`Relaying event ${event.type} (${eventId}) to ${this.remoteUrl}...`);

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
                            user_id: event.actor_user_id,
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
                    'Authorization': `Bearer ${this.adminKey}`, // Usamos admin key para bypass de validaciones si fuera necesario
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
