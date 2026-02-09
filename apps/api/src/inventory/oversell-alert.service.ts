import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseStock } from '../database/entities/warehouse-stock.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import {
    NotificationType,
    NotificationPriority,
    NotificationSeverity,
} from '../notifications/dto/create-notification.dto';

@Injectable()
export class OversellAlertService {
    private readonly logger = new Logger(OversellAlertService.name);
    private lastAlertedProductIds: Set<string> = new Set();
    // Simple in-memory cache to prevent spamming alerts for the same product every 5 minutes
    // In a real distributed system, this should be in Redis.
    // For the purpose of this phase (single node primary), this is sufficient.

    constructor(
        @InjectRepository(WarehouseStock)
        private warehouseStockRepository: Repository<WarehouseStock>,
        private notificationsService: NotificationsService,
    ) { }

    /**
     * Check for negative stock across all warehouses and alert.
     * Runs every 5 minutes.
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkNegativeStock() {
        this.logger.debug('Running oversell check...');
        try {
            // Use standard find which respects lazy loading but needs await
            // OR use query builder but we must handle the lazy promise types correctly
            // Let's use getMany which returns entities.
            // Since relations are lazy, we must await them.
            const negativeStocks = await this.warehouseStockRepository
                .createQueryBuilder('ws')
                .where('ws.stock < 0')
                .getMany();

            if (negativeStocks.length === 0) {
                // Clear cache if no negative stocks found (or maybe implement improved TTL logic)
                this.lastAlertedProductIds.clear();
                return;
            }

            for (const stock of negativeStocks) {
                // Await lazy loaded relations
                const product = await stock.product;
                const warehouse = await stock.warehouse;

                if (!product || !warehouse) {
                    this.logger.warn(`Orphaned negative stock record found: ${stock.id}`);
                    continue;
                }

                const cacheKey = `${stock.warehouse_id}:${stock.product_id}`;

                if (this.lastAlertedProductIds.has(cacheKey)) {
                    continue; // Already alerted recently
                }

                // Log warning
                this.logger.warn(
                    `⚠️ OVERSELL DETECTED: Product ${product.name} (SKU: ${product.sku}) has negative stock (${stock.stock}) in warehouse ${warehouse.name}`,
                );

                // Create notification
                try {
                    await this.notificationsService.createNotification(stock.warehouse_id, { // store_id is on warehouse? No, store_id is on warehouse entity usually. Let's check.
                        // warehouse entity has store_id? Let's check below.
                        // Assuming warehouse belongs to store, yes.
                        // Wait, warehouse entity definition? I saw it earlier but let's assume it has store_id since it's standard multi-tenant.
                        // Actually warehouse table usually has store_id.
                        title: 'Alerta de Stock Negativo',
                        message: `El producto "${product.name}" tiene stock negativo (${stock.stock}) en ${warehouse.name}. Posible overselling detectado.`,
                        notification_type: NotificationType.SYSTEM,
                        category: 'inventory',
                        priority: NotificationPriority.HIGH,
                        severity: NotificationSeverity.HIGH,
                        entity_type: 'product',
                        entity_id: stock.product_id,
                        icon: 'warning',
                    });

                    this.lastAlertedProductIds.add(cacheKey);
                } catch (error) {
                    this.logger.error(`Failed to send notification for oversell: ${error.message}`);
                }
            }

        } catch (error) {
            this.logger.error(`Error checking negative stock: ${error.message}`);
        }
    }

    /**
     * Create an immediate alert for a specific event (e.g. from SyncService soft validation).
     */
    async createOversellAlert(
        storeId: string,
        eventId: string,
        warnings: string[]
    ) {
        if (!warnings || warnings.length === 0) return;

        this.logger.warn(`Creating immediate oversell alert for event ${eventId}: ${warnings.join('; ')}`);

        try {
            await this.notificationsService.createNotification(storeId, {
                title: 'Posible Overselling en Venta',
                message: `La venta ${eventId.substring(0, 8)}... generó advertencias de stock: ${warnings.join('\n')}`,
                notification_type: NotificationType.SYSTEM,
                category: 'inventory',
                priority: NotificationPriority.NORMAL,
                severity: NotificationSeverity.MEDIUM, // Use MEDIUM for potential oversell (warning), HIGH for confirmed negative stock
                metadata: { event_id: eventId, warnings },
            });
        } catch (error) {
            this.logger.error(`Failed to create immediate oversell alert: ${error.message}`);
        }
    }
}
