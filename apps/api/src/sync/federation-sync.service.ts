import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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
