import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertThreshold, AlertType, AlertSeverity } from '../database/entities/alert-threshold.entity';
import { randomUUID } from 'crypto';

/**
 * Configuración predeterminada para métricas y umbrales de alerta
 * Basado en mejores prácticas del retail y análisis de valor para el usuario
 */

interface DefaultThreshold {
    alert_type: AlertType;
    metric_name: string;
    threshold_value: number;
    comparison_operator: 'less_than' | 'greater_than' | 'equals' | 'not_equals';
    severity: AlertSeverity;
    description: string;
    business_value: string;
}

@Injectable()
export class AnalyticsDefaultsService {
    private readonly logger = new Logger(AnalyticsDefaultsService.name);

    constructor(
        @InjectRepository(AlertThreshold)
        private thresholdRepository: Repository<AlertThreshold>,
    ) { }

    /**
     * Obtiene la configuración predeterminada de umbrales de alerta
     * Organizada por niveles de prioridad
     */
    getDefaultThresholds(): DefaultThreshold[] {
        return [
            // ==========================================
            // NIVEL 1: CRÍTICO 🔴
            // ==========================================
            {
                alert_type: 'stock_low',
                metric_name: 'out_of_stock_count',
                threshold_value: 0,
                comparison_operator: 'greater_than',
                severity: 'critical',
                description: 'Productos sin stock disponible',
                business_value: 'Prevenir pérdida de ventas por falta de inventario',
            },
            {
                alert_type: 'revenue_drop',
                metric_name: 'daily_revenue_bs',
                threshold_value: 50, // 50% del promedio histórico
                comparison_operator: 'less_than',
                severity: 'critical',
                description: 'Caída severa de ingresos diarios',
                business_value: 'Detectar problemas graves en ventas inmediatamente',
            },
            {
                alert_type: 'debt_overdue',
                metric_name: 'overdue_debt_bs',
                threshold_value: 10000,
                comparison_operator: 'greater_than',
                severity: 'critical',
                description: 'Deuda vencida superior a 10,000 Bs',
                business_value: 'Proteger flujo de caja y reducir riesgo crediticio',
            },
            {
                alert_type: 'product_expiring',
                metric_name: 'expired_products_count',
                threshold_value: 0,
                comparison_operator: 'greater_than',
                severity: 'critical',
                description: 'Productos ya vencidos en inventario',
                business_value: 'Cumplir normativas y evitar venta de productos no aptos',
            },

            // ==========================================
            // NIVEL 2: ALTA PRIORIDAD 🟠
            // ==========================================
            {
                alert_type: 'stock_low',
                metric_name: 'low_stock_count',
                threshold_value: 5,
                comparison_operator: 'greater_than',
                severity: 'high',
                description: 'Más de 5 productos con stock bajo',
                business_value: 'Planificar reabastecimiento antes de quedarse sin stock',
            },
            {
                alert_type: 'sale_anomaly',
                metric_name: 'daily_sales_count',
                threshold_value: 70, // 70% del promedio
                comparison_operator: 'less_than',
                severity: 'high',
                description: 'Caída significativa en cantidad de ventas',
                business_value: 'Identificar problemas en estrategia comercial',
            },
            {
                alert_type: 'product_expiring',
                metric_name: 'expiring_soon_count',
                threshold_value: 10,
                comparison_operator: 'greater_than',
                severity: 'high',
                description: 'Más de 10 productos próximos a vencer (30 días)',
                business_value: 'Promocionar productos antes de pérdida total',
            },
            {
                alert_type: 'debt_overdue',
                metric_name: 'customers_overdue_count',
                threshold_value: 5,
                comparison_operator: 'greater_than',
                severity: 'high',
                description: 'Más de 5 clientes con deudas vencidas',
                business_value: 'Iniciar procesos de cobranza oportunamente',
            },

            // ==========================================
            // NIVEL 3: MEDIA PRIORIDAD 🟡
            // ==========================================
            {
                alert_type: 'inventory_high',
                metric_name: 'inventory_value_bs',
                threshold_value: 200000,
                comparison_operator: 'greater_than',
                severity: 'medium',
                description: 'Valor de inventario superior a 200,000 Bs',
                business_value: 'Optimizar capital inmovilizado en inventario',
            },
            {
                alert_type: 'sale_anomaly',
                metric_name: 'avg_ticket_bs',
                threshold_value: 80, // 80% del promedio
                comparison_operator: 'less_than',
                severity: 'medium',
                description: 'Ticket promedio bajo',
                business_value: 'Implementar estrategias de upselling y cross-selling',
            },
            {
                alert_type: 'custom',
                metric_name: 'pending_orders_count',
                threshold_value: 10,
                comparison_operator: 'greater_than',
                severity: 'medium',
                description: 'Más de 10 órdenes de compra pendientes',
                business_value: 'Coordinar mejor con proveedores',
            },

            // ==========================================
            // NIVEL 4: INFORMACIÓN ℹ️
            // ==========================================
            {
                alert_type: 'revenue_spike',
                metric_name: 'daily_revenue_bs',
                threshold_value: 150, // 150% del promedio
                comparison_operator: 'greater_than',
                severity: 'low',
                description: 'Pico inusual de ingresos (positivo)',
                business_value: 'Identificar y replicar acciones exitosas',
            },
            {
                alert_type: 'custom',
                metric_name: 'active_customers_count',
                threshold_value: 120, // 120% del promedio
                comparison_operator: 'greater_than',
                severity: 'low',
                description: 'Alto tráfico de clientes activos',
                business_value: 'Reconocer rendimiento excepcional del equipo',
            },
        ];
    }

    /**
     * Aplica la configuración predeterminada de umbrales a una tienda
     * @param storeId ID de la tienda
     * @param userId ID del usuario que aplica la configuración
     * @param customValues Valores personalizados opcionales basados en histórico
     */
    async applyDefaultThresholds(
        storeId: string,
        userId: string,
        customValues?: {
            avgDailyRevenue?: number;
            avgDailySales?: number;
            avgTicket?: number;
        },
    ): Promise<AlertThreshold[]> {
        this.logger.log(`Aplicando umbrales predeterminados para tienda ${storeId}`);

        const defaults = this.getDefaultThresholds();
        const thresholdsToCreate: AlertThreshold[] = [];

        for (const config of defaults) {
            let thresholdValue = config.threshold_value;

            // Ajustar valores porcentuales basados en histórico si está disponible
            if (customValues) {
                if (
                    config.metric_name === 'daily_revenue_bs' &&
                    customValues.avgDailyRevenue
                ) {
                    // Calcular porcentaje del promedio histórico
                    thresholdValue =
                        (customValues.avgDailyRevenue * config.threshold_value) / 100;
                } else if (
                    config.metric_name === 'daily_sales_count' &&
                    customValues.avgDailySales
                ) {
                    thresholdValue =
                        (customValues.avgDailySales * config.threshold_value) / 100;
                } else if (
                    config.metric_name === 'avg_ticket_bs' &&
                    customValues.avgTicket
                ) {
                    thresholdValue =
                        (customValues.avgTicket * config.threshold_value) / 100;
                }
            }

            const threshold = this.thresholdRepository.create({
                id: randomUUID(),
                store_id: storeId,
                alert_type: config.alert_type,
                metric_name: config.metric_name,
                threshold_value: thresholdValue,
                comparison_operator: config.comparison_operator,
                severity: config.severity,
                is_active: true,
                notification_channels: ['in_app'], // Por defecto solo notificaciones in-app
                created_by: userId,
            });

            thresholdsToCreate.push(threshold);
        }

        // Guardar todos los umbrales
        const savedThresholds = await this.thresholdRepository.save(
            thresholdsToCreate,
        );

        this.logger.log(
            `✅ ${savedThresholds.length} umbrales predeterminados creados para tienda ${storeId}`,
        );

        return savedThresholds;
    }

    /**
     * Calcula valores personalizados basados en el histórico de la tienda
     * Útil para tiendas que ya tienen datos
     */
    async calculateHistoricalAverages(
        storeId: string,
        salesRepository: any, // Repository<Sale>
    ): Promise<{
        avgDailyRevenue: number;
        avgDailySales: number;
        avgTicket: number;
    } | null> {
        try {
            // Obtener ventas de los últimos 30 días
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const sales = await salesRepository
                .createQueryBuilder('sale')
                .where('sale.store_id = :storeId', { storeId })
                .andWhere('sale.sold_at >= :startDate', { startDate: thirtyDaysAgo })
                .getMany();

            if (sales.length === 0) {
                this.logger.log(
                    `No hay datos históricos para tienda ${storeId}. Usando valores predeterminados absolutos.`,
                );
                return null;
            }

            // Calcular promedios
            const totalRevenue = sales.reduce(
                (sum, sale) => sum + Number(sale.totals?.total_bs || 0),
                0,
            );
            const daysWithSales = new Set(
                sales.map((sale) => sale.sold_at.toDateString()),
            ).size;

            const avgDailyRevenue = totalRevenue / Math.max(daysWithSales, 1);
            const avgDailySales = sales.length / Math.max(daysWithSales, 1);
            const avgTicket = totalRevenue / sales.length;

            this.logger.log(
                `Promedios calculados para ${storeId}: Revenue=${avgDailyRevenue.toFixed(2)} Bs, Sales=${avgDailySales.toFixed(1)}, Ticket=${avgTicket.toFixed(2)} Bs`,
            );

            return {
                avgDailyRevenue,
                avgDailySales,
                avgTicket,
            };
        } catch (error) {
            this.logger.error(
                `Error calculando promedios históricos: ${error.message}`,
            );
            return null;
        }
    }

    /**
     * Verifica si una tienda ya tiene umbrales configurados
     */
    async hasExistingThresholds(storeId: string): Promise<boolean> {
        const count = await this.thresholdRepository.count({
            where: { store_id: storeId },
        });
        return count > 0;
    }

    /**
     * Obtiene resumen de la configuración predeterminada
     * Útil para mostrar preview al usuario antes de aplicar
     */
    getDefaultsPreview(): {
        totalAlerts: number;
        byPriority: Record<AlertSeverity, number>;
        metrics: string[];
    } {
        const defaults = this.getDefaultThresholds();

        const byPriority: Record<AlertSeverity, number> = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        };

        defaults.forEach((threshold) => {
            byPriority[threshold.severity]++;
        });

        const metrics = [...new Set(defaults.map((t) => t.metric_name))];

        return {
            totalAlerts: defaults.length,
            byPriority,
            metrics,
        };
    }
}
