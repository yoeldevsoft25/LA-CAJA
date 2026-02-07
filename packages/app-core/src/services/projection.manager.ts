import { db, LocalProduct } from '../db/database';
import {
    BaseEvent,
    ProductCreatedPayload,
    ProductUpdatedPayload,
    ProductDeactivatedPayload,
    PriceChangedPayload,
    CustomerCreatedPayload,
    CustomerUpdatedPayload,
    SaleCreatedPayload
} from '@la-caja/domain';
import { createLogger } from '../lib/logger';

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

        await db.transaction('rw', [db.products, db.customers, db.debts, db.localStock, db.localEscrow], async () => {
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
            case 'RecipeIngredientsUpdated':
                await this.applyRecipeIngredientsUpdated(event);
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

            // DEUDAS
            case 'DebtCreated':
                await this.applyDebtCreated(event);
                break;
            case 'DebtPaymentRecorded':
            case 'DebtPaymentAdded':
                await this.applyDebtPaymentAdded(event);
                break;

            // INVENTARIO Y ESCROW
            case 'StockDeltaApplied':
                await this.applyStockDeltaApplied(event);
                break;
            case 'StockQuotaGranted':
                await this.applyStockQuotaGranted(event);
                break;
            case 'StockQuotaReclaimed':
                await this.applyStockQuotaReclaimed(event);
                break;
            case 'SaleCreated':
                await this.applySaleCreated(event);
                break;
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
            weight_unit: null,
            description: payload.description || null,
            image_url: payload.image_url || null,
            is_recipe: payload.is_recipe ?? false,
            profit_margin: payload.profit_margin ?? 0,
            product_type: payload.product_type || (payload.is_recipe ? 'prepared' : 'sale_item'),
            is_visible_public: payload.is_visible_public ?? false,
            public_name: payload.public_name || null,
            public_description: payload.public_description || null,
            public_image_url: payload.public_image_url || null,
            public_category: payload.public_category || null
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

    async applyRecipeIngredientsUpdated(event: BaseEvent) {
        const payload = event.payload as {
            product_id: string;
            ingredients?: Array<{
                ingredient_product_id: string;
                qty: number;
                unit: string | null;
            }>;
        };
        const existing = await db.products.get(payload.product_id);

        if (!existing) return;

        const ingredients = Array.isArray(payload.ingredients)
            ? payload.ingredients
            : [];

        const updated: LocalProduct = {
            ...existing,
            ingredients,
            updated_at: event.created_at,
            cached_at: Date.now()
        };

        await db.products.put(updated);
    },

    async applyCustomerCreated(event: BaseEvent) {
        const payload = event.payload as CustomerCreatedPayload;
        await db.customers.put({
            id: payload.customer_id,
            store_id: event.store_id,
            name: payload.name,
            document_id: payload.document_id || null,
            phone: payload.phone || null,
            email: payload.email || null,
            credit_limit: payload.credit_limit || null,
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
    },

    // --- DEUDAS ---

    async applyDebtCreated(event: BaseEvent) {
        // Tipado manual simple ya que no tenemos el tipo importado aún
        // { debt_id, customer_id, sale_id, amount_bs, amount_usd, note, due_date ... }
        const payload = event.payload as any;

        await db.debts.put({
            id: payload.debt_id,
            store_id: event.store_id,
            customer_id: payload.customer_id,
            sale_id: payload.sale_id || null, // Puede ser deuda legacy sin venta
            amount_bs: Number(payload.amount_bs),
            amount_usd: Number(payload.amount_usd),
            total_paid_bs: 0,
            total_paid_usd: 0,
            remaining_bs: Number(payload.amount_bs),
            remaining_usd: Number(payload.amount_usd),
            status: 'open',
            created_at: event.created_at,
            updated_at: event.created_at,
            cached_at: Date.now(),
            note: payload.note || null
        });
    },

    async applyDebtPaymentAdded(event: BaseEvent) {
        const payload = event.payload as any;
        const debtId = payload.debt_id;
        const amountBs = Number(payload.amount_bs);
        const amountUsd = Number(payload.amount_usd);

        const existing = await db.debts.get(debtId);
        if (existing) {
            // Recalcular totales
            // Nota: Esto es una simplificación optimista. El backend es la fuente de verdad.
            // Pero para UI offline, sumamos lo que tenemos.

            const newTotalPaidBs = (existing.total_paid_bs || 0) + amountBs;
            const newTotalPaidUsd = (existing.total_paid_usd || 0) + amountUsd;

            const newRemainingBs = existing.amount_bs - newTotalPaidBs;
            const newRemainingUsd = existing.amount_usd - newTotalPaidUsd;

            // Determinar estado
            // Tolerancia pequeña por errores de punto flotante
            let newStatus: 'open' | 'partial' | 'paid' = 'partial';
            if (newRemainingUsd <= 0.01 && newRemainingBs <= 0.01) {
                newStatus = 'paid';
            } else if (newTotalPaidUsd <= 0.01 && newTotalPaidBs <= 0.01) {
                newStatus = 'open';
            }

            const updated = {
                ...existing,
                total_paid_bs: newTotalPaidBs,
                total_paid_usd: newTotalPaidUsd,
                remaining_bs: Math.max(0, newRemainingBs),
                remaining_usd: Math.max(0, newRemainingUsd),
                status: newStatus,
                updated_at: event.created_at,
                cached_at: Date.now()
            };

            await db.debts.put(updated);
        }
    },

    // --- INVENTARIO Y ESCROW ---

    async applyStockDeltaApplied(event: BaseEvent) {
        const payload = event.payload as any; // StockDeltaAppliedPayload
        const productId = payload.product_id;
        const variantId = payload.variant_id ?? null;
        const qtyDelta = Number(payload.qty_delta);
        const id = `${productId}:${variantId || 'null'}`;

        await db.transaction('rw', db.localStock, async () => {
            const existing = await db.localStock.get(id);
            if (existing) {
                existing.stock = (existing.stock || 0) + qtyDelta;
                existing.updated_at = event.created_at;
                await db.localStock.put(existing);
            } else {
                await db.localStock.put({
                    id,
                    store_id: event.store_id,
                    product_id: productId,
                    variant_id: variantId,
                    stock: qtyDelta,
                    updated_at: event.created_at
                });
            }
        });
    },

    async applyStockQuotaGranted(event: BaseEvent) {
        const payload = event.payload as any; // StockQuotaGrantedPayload
        const productId = payload.product_id;
        const variantId = payload.variant_id ?? null;
        const qtyGranted = Number(payload.qty_granted);
        const id = `${productId}:${variantId || 'null'}`;

        await db.transaction('rw', db.localEscrow, async () => {
            const existing = await db.localEscrow.get(id);
            if (existing) {
                existing.qty_granted = (existing.qty_granted || 0) + qtyGranted;
                existing.expires_at = payload.expires_at || existing.expires_at;
                existing.updated_at = event.created_at;
                await db.localEscrow.put(existing);
            } else {
                await db.localEscrow.put({
                    id,
                    store_id: event.store_id,
                    product_id: productId,
                    variant_id: variantId,
                    qty_granted: qtyGranted,
                    expires_at: payload.expires_at || null,
                    updated_at: event.created_at
                });
            }
        });
    },

    async applyStockQuotaReclaimed(event: BaseEvent) {
        const payload = event.payload as any; // StockQuotaReclaimedPayload
        const productId = payload.product_id;
        const variantId = payload.variant_id ?? null;
        const id = `${productId}:${variantId || 'null'}`;

        await db.localEscrow.delete(id);
    },

    async applySaleCreated(event: BaseEvent) {
        const payload = event.payload as SaleCreatedPayload;
        const storeId = event.store_id;

        for (const item of payload.items) {
            const productId = item.product_id;
            const variantId = (item as any).variant_id ?? null;
            const qty = Number(item.qty);
            const id = `${productId}:${variantId || 'null'}`;

            await db.transaction('rw', db.localStock, async () => {
                const existing = await db.localStock.get(id);
                if (existing) {
                    existing.stock = (existing.stock || 0) - qty;
                    existing.updated_at = event.created_at;
                    await db.localStock.put(existing);
                } else {
                    // Si no existe, lo creamos con stock negativo (asumiendo que prefetch se perdió esto)
                    await db.localStock.put({
                        id,
                        store_id: storeId,
                        product_id: productId,
                        variant_id: variantId,
                        stock: -qty,
                        updated_at: event.created_at
                    });
                }
            });
        }
    }
};
