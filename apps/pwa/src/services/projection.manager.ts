import { db, LocalProduct } from '@/db/database';
import {
    BaseEvent,
    ProductCreatedPayload,
    ProductUpdatedPayload,
    ProductDeactivatedPayload,
    PriceChangedPayload,
    CustomerCreatedPayload,
    CustomerUpdatedPayload
} from '@la-caja/domain';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ProjectionManager');

/**
 * Gestiona la proyección de eventos de dominio a los "Read Models" locales (IndexedDB).
 * Permite que la PWA replique el estado del servidor a partir de los eventos recibidos.
 */
export const projectionManager = {

    /**
     * Aplica un lote de eventos a la base de datos local
     */
    async applyEvents(events: BaseEvent[]): Promise<number> {
        if (!events || events.length === 0) return 0;

        let appliedCount = 0;

        // Usamos transacción para atomicidad básica por evento, 
        // pero permitimos que algunos fallen sin bloquear todo el lote
        // (Consistencia eventual)

        // Agrupamos por tipo para debugging
        const byType: Record<string, number> = {};

        await db.transaction('rw', db.products, db.customers, async () => {
            for (const event of events) {
                try {
                    await this.applyEvent(event);
                    appliedCount++;
                    byType[event.type] = (byType[event.type] || 0) + 1;
                } catch (error) {
                    logger.error(`Error proyectando evento ${event.type} (${event.event_id})`, { error });
                }
            }
        });

        if (appliedCount > 0) {
            logger.debug(`Proyectados ${appliedCount} eventos`, { types: byType });
        }

        return appliedCount;
    },

    async applyEvent(event: BaseEvent) {
        if (!event.payload) return;

        switch (event.type) {
            // PRODUCTOS
            case 'ProductCreated':
                await this.applyProductCreated(event);
                break;
            case 'ProductUpdated':
                await this.applyProductUpdated(event);
                break;
            case 'ProductDeactivated':
                await this.applyProductDeactivated(event);
                break;
            case 'PriceChanged':     // Nombre corto
            case 'ProductPriceChanged': // Nombre largo (por si acaso)
                await this.applyPriceChanged(event);
                break;

            // CLIENTES
            case 'CustomerCreated':
                await this.applyCustomerCreated(event);
                break;
            case 'CustomerUpdated':
                await this.applyCustomerUpdated(event);
                break;

            // TODO: Implementar más proyecciones (Inventario, etc.)
        }
    },

    // --- IMPLEMENTACIONES ESPECIFICAS ---

    async applyProductCreated(event: BaseEvent) {
        const payload = event.payload as ProductCreatedPayload;

        // Mapear payload a LocalProduct
        // Nota: event.created_at es number (timestamp)
        const product: LocalProduct = {
            id: payload.product_id,
            store_id: event.store_id,
            name: payload.name,
            category: payload.category || null,
            sku: payload.sku || null,
            barcode: payload.barcode || null,
            price_bs: Number(payload.price_bs),
            price_usd: Number(payload.price_usd),
            cost_bs: Number(payload.cost_bs),
            cost_usd: Number(payload.cost_usd),
            low_stock_threshold: Number(payload.low_stock_threshold || 5),
            is_active: payload.is_active,
            updated_at: event.created_at,
            cached_at: Date.now(),
            // Valores por defecto para campos opcionales que no siempre vienen en ProductCreated
            is_weight_product: false,
            weight_unit: null
        };

        // Dexie put: crea o reemplaza
        await db.products.put(product);
    },

    async applyProductUpdated(event: BaseEvent) {
        const payload = event.payload as ProductUpdatedPayload;
        const existing = await db.products.get(payload.product_id);

        if (!existing) {
            // Si el producto no existe localmente, en teoría deberíamos pedirlo al servidor.
            // Pero para este sync básico, lo ignoramos.
            return;
        }

        // Merge cuidadoso del patch
        const patch = payload.patch || {};
        const updated: LocalProduct = {
            ...existing,
            ...patch,
            updated_at: event.created_at,
            cached_at: Date.now()
        };

        await db.products.put(updated);
    },

    async applyProductDeactivated(event: BaseEvent) {
        const payload = event.payload as ProductDeactivatedPayload;
        const existing = await db.products.get(payload.product_id);

        if (existing) {
            existing.is_active = payload.is_active; // false
            existing.updated_at = event.created_at;
            existing.cached_at = Date.now();
            await db.products.put(existing);
        }
    },

    async applyPriceChanged(event: BaseEvent) {
        const payload = event.payload as PriceChangedPayload;
        const existing = await db.products.get(payload.product_id);

        if (existing) {
            existing.price_bs = Number(payload.price_bs);
            existing.price_usd = Number(payload.price_usd);
            existing.updated_at = event.created_at; // O payload.effective_at
            existing.cached_at = Date.now();
            await db.products.put(existing);
        }
    },

    async applyCustomerCreated(event: BaseEvent) {
        const payload = event.payload as CustomerCreatedPayload;
        await db.customers.put({
            id: payload.customer_id,
            store_id: event.store_id,
            name: payload.name,
            document_id: null, // Asumir null si no viene en el evento base
            phone: payload.phone || null,
            note: payload.note || null,
            updated_at: event.created_at,
            cached_at: Date.now()
        });
    },

    async applyCustomerUpdated(event: BaseEvent) {
        const payload = event.payload as CustomerUpdatedPayload;
        const existing = await db.customers.get(payload.customer_id);
        if (existing) {
            const updated = {
                ...existing,
                ...payload.patch,
                updated_at: event.created_at,
                cached_at: Date.now()
            };
            await db.customers.put(updated);
        }
    }
};
