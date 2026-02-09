
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { FederationHealthReport } from './split-brain-monitor.service';
import {
    NotificationType,
    NotificationPriority,
    NotificationSeverity
} from '../notifications/dto/create-notification.dto';

@Injectable()
export class FederationAlertsService {
    private readonly logger = new Logger(FederationAlertsService.name);
    private lastAlerts = new Map<string, number>();
    private readonly COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

    constructor(
        private notificationsService: NotificationsService
    ) { }

    async checkAndAlert(storeId: string, report: FederationHealthReport) {
        // 1. Overall Critical Health
        if (report.overallHealth === 'critical') {
            await this.sendAlert(storeId, 'FEDERATION_CRITICAL', {
                title: '🚨 Salud de Federación CRÍTICA',
                message: 'El sistema presenta problemas graves de consistencia o conectividad. Revise el panel de control inmediato.',
                priority: NotificationPriority.URGENT,
                severity: NotificationSeverity.CRITICAL
            });
        }

        // 2. Projection Gaps
        if (report.metrics.projectionGapCount > 0) {
            await this.sendAlert(storeId, 'PROJECTION_GAP_DETECTED', {
                title: '⚠️ Errores de Proyección Detectados',
                message: `Se encontraron ${report.metrics.projectionGapCount} eventos sin procesar correctamente (Gaps).`,
                priority: NotificationPriority.HIGH,
                severity: NotificationSeverity.HIGH
            });
        }

        // 3. Overselling / Negative Stock
        if (report.metrics.negativeStockCount > 0) {
            await this.sendAlert(storeId, 'OVERSELLING_DETECTED', {
                title: '📉 Stock Negativo Detectado',
                message: `Se detectaron ${report.metrics.negativeStockCount} productos con stock negativo. Posible overselling offline.`,
                priority: NotificationPriority.HIGH,
                severity: NotificationSeverity.HIGH
            });
        }

        // 4. Fiscal Duplicates (Highest Priority)
        if (report.metrics.fiscalDuplicates > 0) {
            await this.sendAlert(storeId, 'FISCAL_DUPLICATE', {
                title: '🔥 ERROR FISCAL GRAVE: Duplicados',
                message: `Se detectaron ${report.metrics.fiscalDuplicates} números fiscales duplicados. Acción inmediata requerida.`,
                priority: NotificationPriority.URGENT,
                severity: NotificationSeverity.CRITICAL
            });
        }

        // 5. Federation Offline
        if (!report.metrics.remoteReachable) {
            await this.sendAlert(storeId, 'FEDERATION_OFFLINE', {
                title: '📡 Conexión Remota Perdida',
                message: 'No se puede contactar al servidor central. La sincronización está detenida.',
                priority: NotificationPriority.HIGH,
                severity: NotificationSeverity.MEDIUM
            });
        }

        // 6. Outbox Dead Entries
        if (report.metrics.outboxDead > 0) {
            await this.sendAlert(storeId, 'OUTBOX_DEAD_ENTRIES', {
                title: '💀 Errores Fatales en Sync',
                message: `Hay ${report.metrics.outboxDead} eventos que fallaron permanentemente en la sincronización.`,
                priority: NotificationPriority.HIGH,
                severity: NotificationSeverity.HIGH
            });
        }
    }

    private async sendAlert(
        storeId: string,
        alertKey: string,
        content: {
            title: string,
            message: string,
            priority: NotificationPriority,
            severity: NotificationSeverity
        }
    ) {
        const key = `${storeId}:${alertKey}`;
        const lastSent = this.lastAlerts.get(key) || 0;
        const now = Date.now();

        if (now - lastSent < this.COOLDOWN_MS) {
            return; // Cooldown active
        }

        try {
            await this.notificationsService.createNotification(storeId, {
                notification_type: NotificationType.ALERT,
                category: 'federation_health',
                title: content.title,
                message: content.message,
                priority: content.priority,
                severity: content.severity,
                metadata: { alertKey },
                delivery_channels: ['in_app', 'push'], // Add push if critical?
                user_id: undefined // Global store notification
            });

            this.lastAlerts.set(key, now);
            this.logger.warn(`🔔 Alert sent [${storeId}]: ${alertKey}`);
        } catch (error) {
            this.logger.error(`Failed to send alert ${alertKey}`, error);
        }
    }
}
