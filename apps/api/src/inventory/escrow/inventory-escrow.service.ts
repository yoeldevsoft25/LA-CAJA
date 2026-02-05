import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Event } from '../../database/entities/event.entity';
import { Product } from '../../database/entities/product.entity';
import { StockEscrow } from '../../database/entities/stock-escrow.entity';
import { FederationSyncService } from '../../sync/federation-sync.service';
import { GrantStockQuotaDto } from './dto/grant-stock-quota.dto';
import { TransferStockQuotaDto } from './dto/transfer-stock-quota.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class InventoryEscrowService {
    private readonly logger = new Logger(InventoryEscrowService.name);
    private readonly serverDeviceId = '00000000-0000-0000-0000-000000000001';

    constructor(
        @InjectRepository(Event)
        private eventRepository: Repository<Event>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        @InjectRepository(StockEscrow)
        private stockEscrowRepository: Repository<StockEscrow>,
        private federationSyncService: FederationSyncService,
        private dataSource: DataSource,
    ) { }

    async grantQuota(
        storeId: string,
        userId: string,
        dto: GrantStockQuotaDto,
    ): Promise<any> {
        return await this.dataSource.transaction(async (manager) => {
            // 0. Idempotency check
            if (dto.request_id) {
                const existingEvent = await manager.findOne(Event, {
                    where: { store_id: storeId, request_id: dto.request_id },
                });
                if (existingEvent) {
                    return {
                        success: true,
                        event_id: existingEvent.event_id,
                        request_id: existingEvent.request_id,
                        is_duplicate: true,
                    };
                }
            }

            // 1. Validar producto
            const product = await manager.findOne(Product, {
                where: { id: dto.product_id, store_id: storeId },
            });
            if (!product) throw new NotFoundException('Producto no encontrado');

            // 2. Emitir evento StockQuotaGranted
            const eventSeq = Date.now();
            const event = manager.create(Event, {
                event_id: randomUUID(),
                store_id: storeId,
                device_id: this.serverDeviceId,
                seq: eventSeq,
                type: 'StockQuotaGranted',
                version: 1,
                created_at: new Date(),
                actor_user_id: userId,
                actor_role: 'owner',
                request_id: dto.request_id,
                payload: {
                    quota_id: randomUUID(),
                    product_id: dto.product_id,
                    device_id: dto.device_id,
                    qty_granted: dto.qty,
                    expires_at: dto.expires_at || null,
                    request_id: dto.request_id,
                },
                vector_clock: { [this.serverDeviceId]: eventSeq },
            });

            const savedEvent = await manager.save(Event, event);

            // Post-processing: Relay
            await this.federationSyncService.queueRelay(savedEvent);

            return {
                success: true,
                event_id: savedEvent.event_id,
                request_id: dto.request_id
            };
        });
    }

    async transferQuota(
        storeId: string,
        userId: string,
        dto: TransferStockQuotaDto,
    ): Promise<any> {
        return await this.dataSource.transaction(async (manager) => {
            // 0. Idempotency check
            if (dto.request_id) {
                const existingEvent = await manager.findOne(Event, {
                    where: { store_id: storeId, request_id: dto.request_id },
                });
                if (existingEvent) {
                    return {
                        success: true,
                        event_id: existingEvent.event_id,
                        request_id: existingEvent.request_id,
                        is_duplicate: true,
                    };
                }
            }

            // 1. Emitir evento StockQuotaTransferred
            const eventSeq = Date.now();
            const event = manager.create(Event, {
                event_id: randomUUID(),
                store_id: storeId,
                device_id: this.serverDeviceId,
                seq: eventSeq,
                type: 'StockQuotaTransferred',
                version: 1,
                created_at: new Date(),
                actor_user_id: userId,
                actor_role: 'owner',
                request_id: dto.request_id,
                payload: {
                    from_device_id: dto.from_device_id,
                    to_device_id: dto.to_device_id,
                    product_id: dto.product_id,
                    qty: dto.qty,
                    request_id: dto.request_id,
                },
                vector_clock: { [this.serverDeviceId]: eventSeq },
            });

            const savedEvent = await manager.save(Event, event);

            // Post-processing: Relay
            await this.federationSyncService.queueRelay(savedEvent);

            return {
                success: true,
                event_id: savedEvent.event_id,
                request_id: dto.request_id
            };
        });
    }

    async getStatus(storeId: string): Promise<StockEscrow[]> {
        return this.stockEscrowRepository.find({
            where: { store_id: storeId },
        });
    }

    async reclaimExpiredQuotas(storeId: string, userId?: string): Promise<any> {
        const now = new Date();

        return this.dataSource.transaction(async (manager) => {
            const expiredRecords = await manager.createQueryBuilder(StockEscrow, 'e')
                .where('e.store_id = :storeId', { storeId })
                .andWhere('e.expires_at IS NOT NULL')
                .andWhere('e.expires_at < :now', { now })
                .andWhere('e.qty_granted > 0')
                .getMany();

            const results: any[] = [];

            for (const record of expiredRecords) {
                const eventSeq = Date.now();
                const event = manager.create(Event, {
                    event_id: randomUUID(),
                    store_id: storeId,
                    device_id: this.serverDeviceId,
                    seq: eventSeq,
                    type: 'StockQuotaReclaimed',
                    version: 1,
                    created_at: new Date(),
                    actor_user_id: userId || 'SYSTEM',
                    actor_role: 'system',
                    request_id: randomUUID(),
                    payload: {
                        product_id: record.product_id,
                        variant_id: record.variant_id,
                        device_id: record.device_id,
                        qty_reclaimed: record.qty_granted,
                        request_id: randomUUID(),
                        reason: 'Auto-reclaim due to expiration',
                    },
                    vector_clock: { [this.serverDeviceId]: eventSeq },
                });

                const savedEvent = await manager.save(Event, event);
                await this.federationSyncService.queueRelay(savedEvent);
                results.push({
                    product_id: record.product_id,
                    device_id: record.device_id,
                    qty: record.qty_granted,
                });
            }

            return {
                total_reclaimed: results.length,
                details: results,
            };
        });
    }
}
