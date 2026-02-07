import { api } from '../runtime/api';
import { syncService } from './sync.service';
import { exchangeService } from './exchange.service';
import {
    BaseEvent,
    SaleCreatedPayload,
    SaleItem as DomainSaleItem,
    PricingCalculator,
    WeightUnit,
    CashLedgerEntryCreatedPayload,
} from '@la-caja/domain';
import { createLogger } from '../lib/logger';
import { randomUUID } from '../lib/uuid';
import { db } from '../db/database';
import { Product } from './products.service';
import {
    CreateSaleRequest,
    CartItemDto,
    Sale,
    ReturnSaleItemDto,
    SaleReturn
} from '../types/sales.types';

const logger = createLogger('SalesService');

function getDeviceId(): string {
    if (typeof localStorage === 'undefined') return 'unknown';
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = randomUUID();
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

function resolveOfflineItemPricing(
    product: Product,
    item: CartItemDto,
): {
    qty: number;
    unit_price_bs: number;
    unit_price_usd: number;
    discount_bs: number;
    discount_usd: number;
    subtotal_bs: number;
    subtotal_usd: number;
    is_weight_product: boolean;
    weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;
    weight_value: number | null;
    price_per_weight_bs: number | null;
    price_per_weight_usd: number | null;
} {
    const isWeightProduct = Boolean(item.is_weight_product || product.is_weight_product);
    const itemDiscountBs = item.discount_bs || 0;
    const itemDiscountUsd = item.discount_usd || 0;

    const toNumber = (value: number | string | null | undefined): number => {
        if (value === null || value === undefined) return 0;
        return typeof value === 'string' ? parseFloat(value) || 0 : value;
    };

    if (isWeightProduct) {
        const weightValue = item.weight_value || item.qty || 0;
        const pricePerWeightBs = toNumber(item.price_per_weight_bs ?? product.price_per_weight_bs ?? 0);
        const pricePerWeightUsd = toNumber(item.price_per_weight_usd ?? product.price_per_weight_usd ?? 0);

        const totals = PricingCalculator.calculateItemTotals({
            qty: weightValue,
            unitPriceBs: 0,
            unitPriceUsd: 0,
            discountBs: itemDiscountBs,
            discountUsd: itemDiscountUsd,
            isWeightProduct: true,
            weightUnit: (item.weight_unit || product.weight_unit || 'kg') as WeightUnit,
            weightValue: weightValue,
            pricePerWeightBs: pricePerWeightBs,
            pricePerWeightUsd: pricePerWeightUsd,
        });

        return {
            qty: totals.qty,
            unit_price_bs: totals.effectivePriceBs,
            unit_price_usd: totals.effectivePriceUsd,
            discount_bs: totals.discountBs,
            discount_usd: totals.discountUsd,
            subtotal_bs: totals.subtotalBs,
            subtotal_usd: totals.subtotalUsd,
            is_weight_product: true,
            weight_unit: (item.weight_unit || product.weight_unit || null) as any,
            weight_value: weightValue,
            price_per_weight_bs: pricePerWeightBs || null,
            price_per_weight_usd: pricePerWeightUsd || null,
        };
    }

    const unitPriceBs = toNumber(product.price_bs);
    const unitPriceUsd = toNumber(product.price_usd);

    const totals = PricingCalculator.calculateItemTotals({
        qty: item.qty,
        unitPriceBs: unitPriceBs,
        unitPriceUsd: unitPriceUsd,
        discountBs: itemDiscountBs,
        discountUsd: itemDiscountUsd,
        isWeightProduct: false,
    });

    return {
        qty: totals.qty,
        unit_price_bs: totals.effectivePriceBs,
        unit_price_usd: totals.effectivePriceUsd,
        discount_bs: totals.discountBs,
        discount_usd: totals.discountUsd,
        subtotal_bs: totals.subtotalBs,
        subtotal_usd: totals.subtotalUsd,
        is_weight_product: false,
        weight_unit: null,
        weight_value: null,
        price_per_weight_bs: null,
        price_per_weight_usd: null,
    };
}

async function validateOfflineStock(
    items: CartItemDto[],
    options?: { isEmergency?: boolean }
): Promise<{ valid: boolean; error?: string }> {
    const now = Date.now();

    for (const item of items) {
        const id = `${item.product_id}:${item.variant_id || 'null'}`;
        const [localStock, localEscrow] = await Promise.all([
            db.localStock.get(id),
            db.localEscrow.get(id)
        ]);

        const stock = localStock?.stock || 0;
        let escrow = 0;
        if (localEscrow && (localEscrow.expires_at === null || localEscrow.expires_at > now)) {
            escrow = localEscrow.qty_granted || 0;
        }

        const available = stock + escrow;
        const requested = item.qty;

        if (requested > available) {
            const product = await db.products.get(item.product_id);
            const errorMsg = `Stock insuficiente para "${product?.name || item.product_id}". Disponible: ${available.toFixed(2)}, Requerido: ${requested.toFixed(2)}.`;

            if (!options?.isEmergency) {
                throw new Error(errorMsg);
            }

            logger.warn(`MODO EMERGENCIA: Permitiendo venta sin stock: ${errorMsg}`);
            return { valid: false, error: errorMsg };
        }
    }
    return { valid: true };
}

export const salesService = {
    async create(
        data: CreateSaleRequest,
        options?: { returnMode?: 'full' | 'minimal' },
    ): Promise<Sale> {
        const requestId = data.request_id || randomUUID();
        data.request_id = requestId;

        const deviceId = data.device_id || getDeviceId();
        data.device_id = deviceId;

        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

        if (!isOnline) {
            if (!data.store_id || !data.user_id) {
                throw new Error('Se requiere store_id y user_id para guardar ventas offline');
            }

            let isEmergencySale = false;
            if (!data.skip_stock_validation) {
                try {
                    await validateOfflineStock(data.items);
                } catch (error) {
                    logger.warn('Validación de stock falló en modo offline', error as any);
                    isEmergencySale = true;
                }
            }

            if (data.payment_method === 'FIAO' && !data.customer_id && !(data.customer_name && data.customer_document_id)) {
                throw new Error('Las ventas FIAO requieren un cliente.');
            }

            const saleId = randomUUID();
            const now = Date.now();

            let exchangeRate = data.exchange_rate;
            if (!exchangeRate || exchangeRate <= 0) {
                const cachedRate = await exchangeService.getCachedRate();
                exchangeRate = cachedRate.rate || 36;
            }

            let subtotalBs = 0;
            let subtotalUsd = 0;
            let discountBs = 0;
            let discountUsd = 0;

            const saleItems: DomainSaleItem[] = [];
            for (const item of data.items) {
                const localProduct = await db.products.get(item.product_id);
                if (!localProduct) continue;

                const product: Product = {
                    ...localProduct,
                    updated_at: new Date(localProduct.updated_at).toISOString(),
                };

                const resolved = resolveOfflineItemPricing(product, item);
                subtotalBs += resolved.subtotal_bs;
                subtotalUsd += resolved.subtotal_usd;
                discountBs += resolved.discount_bs;
                discountUsd += resolved.discount_usd;

                saleItems.push({
                    line_id: randomUUID(),
                    product_id: item.product_id,
                    qty: resolved.qty,
                    unit_price_bs: resolved.unit_price_bs,
                    unit_price_usd: resolved.unit_price_usd,
                    discount_bs: resolved.discount_bs,
                    discount_usd: resolved.discount_usd,
                    is_weight_product: resolved.is_weight_product,
                    weight_unit: resolved.weight_unit,
                    weight_value: resolved.weight_value,
                    price_per_weight_bs: resolved.price_per_weight_bs,
                    price_per_weight_usd: resolved.price_per_weight_usd,
                });
            }

            const totals = {
                subtotal_bs: subtotalBs,
                subtotal_usd: subtotalUsd,
                discount_bs: discountBs,
                discount_usd: discountUsd,
                total_bs: subtotalBs - discountBs,
                total_usd: subtotalUsd - discountUsd,
            };

            const payload: SaleCreatedPayload = {
                sale_id: saleId,
                cash_session_id: data.cash_session_id || '',
                sold_at: now,
                exchange_rate: exchangeRate,
                currency: data.currency,
                items: saleItems,
                totals,
                metadata: isEmergencySale ? { is_emergency: true } : undefined,
                payment: {
                    method: data.payment_method,
                    split: data.split ? {
                        cash_bs: data.split.cash_bs ?? 0,
                        cash_usd: data.split.cash_usd ?? 0,
                        pago_movil_bs: data.split.pago_movil_bs ?? 0,
                        transfer_bs: data.split.transfer_bs ?? 0,
                        other_bs: data.split.other_bs ?? 0,
                    } : undefined,
                },
                customer: data.customer_id ? { customer_id: data.customer_id } : undefined,
                note: data.note || undefined,
                request_id: requestId,
            };

            const allEvents = await db.localEvents.orderBy('seq').reverse().limit(1).toArray();
            const nextSeq = allEvents.length > 0 ? allEvents[0].seq + 1 : 1;

            const saleEvent: BaseEvent = {
                event_id: randomUUID(),
                store_id: data.store_id,
                device_id: deviceId,
                seq: nextSeq,
                type: 'SaleCreated',
                version: 1,
                created_at: now,
                actor: {
                    user_id: data.user_id,
                    role: data.user_role || 'cashier',
                },
                payload,
            };

            await syncService.enqueueEvent(saleEvent);

            if (data.payment_method !== 'FIAO') {
                const ledgerPayload: CashLedgerEntryCreatedPayload = {
                    entry_id: saleId,
                    request_id: requestId,
                    entry_type: 'sale',
                    amount_bs: totals.total_bs,
                    amount_usd: totals.total_usd,
                    currency: data.currency,
                    cash_session_id: data.cash_session_id || '',
                    sold_at: now,
                    metadata: {
                        sale_id: saleId,
                        payment_method: data.payment_method,
                    },
                };

                const ledgerEvent: BaseEvent = {
                    event_id: randomUUID(),
                    store_id: data.store_id,
                    device_id: deviceId,
                    seq: nextSeq + 1,
                    type: 'CashLedgerEntryCreated',
                    version: 1,
                    created_at: now,
                    actor: {
                        user_id: data.user_id,
                        role: data.user_role || 'cashier',
                    },
                    payload: ledgerPayload,
                };
                await syncService.enqueueEvent(ledgerEvent);
            }

            return {
                id: saleId,
                store_id: data.store_id,
                cash_session_id: data.cash_session_id || null,
                customer_id: data.customer_id || null,
                sold_by_user_id: data.user_id || null,
                exchange_rate: exchangeRate,
                currency: data.currency,
                totals: {
                    subtotal_bs: totals.subtotal_bs.toString(),
                    subtotal_usd: totals.subtotal_usd.toString(),
                    discount_bs: totals.discount_bs.toString(),
                    discount_usd: totals.discount_usd.toString(),
                    total_bs: totals.total_bs.toString(),
                    total_usd: totals.total_usd.toString(),
                },
                sold_at: new Date(now).toISOString(),
                items: saleItems.map(item => ({
                    id: item.line_id,
                    product_id: item.product_id,
                    qty: item.qty,
                    unit_price_bs: item.unit_price_bs,
                    unit_price_usd: item.unit_price_usd,
                    discount_bs: item.discount_bs,
                    discount_usd: item.discount_usd,
                    is_weight_product: item.is_weight_product,
                    weight_unit: item.weight_unit || null,
                    weight_value: item.weight_value || null,
                    price_per_weight_bs: item.price_per_weight_bs || null,
                    price_per_weight_usd: item.price_per_weight_usd || null,
                })),
                payment: {
                    method: data.payment_method,
                    split: data.split,
                    split_payments: data.split_payments,
                    cash_payment: data.cash_payment,
                    cash_payment_bs: data.cash_payment_bs,
                },
                note: data.note || null,
            };
        }

        try {
            const cleanedData = Object.fromEntries(
                Object.entries(data).filter(
                    ([key, value]) =>
                        !['store_id', 'user_id', 'user_role'].includes(key) &&
                        value !== undefined &&
                        value !== ''
                )
            );

            const response = await api.post<Sale>('/sales', cleanedData, {
                timeout: 60000,
                ...(options?.returnMode ? { params: { return: options.returnMode } } : {}),
            });

            return response.data;
        } catch (error: any) {
            const isNetworkError = !error.response || error.code === 'ECONNABORTED' || !navigator.onLine;
            if (isNetworkError && data.store_id && data.user_id) {
                // Fallback a modo offline (reutilizaría lógica arriba, pero por brevedad lanzamos si no hay red y no pudimos procesar)
                logger.warn('Error de red detectado en creación de venta online');
            }
            throw error;
        }
    },

    async getById(id: string): Promise<Sale> {
        const response = await api.get<Sale>(`/sales/${id}`);
        return response.data;
    },

    async voidSale(id: string, reason?: string): Promise<Sale> {
        const response = await api.post<Sale>(`/sales/${id}/void`, { reason });
        return response.data;
    },

    async list(params?: {
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
        store_id?: string;
    }): Promise<{ sales: Sale[]; total: number }> {
        const response = await api.get<{ sales: Sale[]; total: number }>('/sales', { params });
        return response.data;
    },

    async returnItems(
        saleId: string,
        items: ReturnSaleItemDto[],
        reason?: string
    ): Promise<SaleReturn> {
        const response = await api.post<SaleReturn>(`/sales/${saleId}/return`, {
            items,
            reason,
        });
        return response.data;
    },
};
