import { db } from '@la-caja/app-core';
import { inventoryService } from '@/services/inventory.service';

export interface StockWarning {
    product_id: string;
    product_name: string;
    requested: number;
    available: number;
    message: string;
}

export interface StockError {
    product_id: string;
    product_name: string;
    requested: number;
    available: number;
    message: string;
}

export interface StockValidationResult {
    valid: boolean;
    warnings: StockWarning[];
    errors: StockError[];
}

class StockValidatorService {
    private async verifyLiveStockIfNeeded(
        productId: string,
        requestedQty: number,
        localAvailable: number,
        escrow: number
    ): Promise<{ available: number; stock: number }> {
        if (!navigator.onLine || localAvailable >= requestedQty) {
            return { available: localAvailable, stock: Math.max(0, localAvailable - escrow) };
        }

        try {
            const liveStock = await inventoryService.getProductStock(productId);
            const stock = Number(liveStock.current_stock || 0);
            const available = stock + escrow;
            return { available, stock };
        } catch (error) {
            console.warn('Live stock verification failed, using local cache', { productId, error });
            return { available: localAvailable, stock: Math.max(0, localAvailable - escrow) };
        }
    }

    /**
     * Valida stock contra IndexedDB antes de permitir una venta.
     * Política Fail-Open: Si hay error leyendo DB, permite la venta.
     */
    async validateBeforeSale(
        items: Array<{ product_id: string; qty: number; name: string }>,
        isOnline: boolean,
    ): Promise<StockValidationResult> {
        const result: StockValidationResult = {
            valid: true,
            warnings: [],
            errors: [],
        };

        try {
            const validationPromises = items.map(async (item) => {
                // 1. Obtener producto para ver si trackea inventario (usando cache local de productos)
                // Nota: Si no está en cache, asumimos que NO trackea inventario (Fail Open)
                const product = await db.products.get(item.product_id);

                // Si es un servicio o no trackea stock, skip
                // TODO: Ajustar lógica si 'product_type' define esto
                if (product && product.product_type === 'prepared') {
                    return null;
                }

                // 2. Obtener stock local
                // ID compuesto product_id:variant_id (variant es null por ahora)
                const id = `${item.product_id}:null`;
                const [stockEntry, escrowEntry] = await Promise.all([
                    db.localStock.get(id),
                    db.localEscrow.get(id)
                ]);

                let available = stockEntry ? stockEntry.stock : 0;
                let escrow = 0;

                // Sumar escrow si es válido y no ha expirado
                if (escrowEntry && (escrowEntry.expires_at === null || escrowEntry.expires_at > Date.now())) {
                    escrow = escrowEntry.qty_granted || 0;
                    available += escrow;
                }

                const liveCheck = await this.verifyLiveStockIfNeeded(
                    item.product_id,
                    item.qty,
                    available,
                    escrow
                );
                available = liveCheck.available;
                const effectiveStock = liveCheck.stock;

                // 3. Validar
                if (available < item.qty) {
                    const msg = `Stock insuficiente: ${available} disponible (Stock: ${effectiveStock}, Cuota: ${escrow}), ${item.qty} solicitado.`;

                    if (isOnline) {
                        // Online: Warning (Fail Open, el server validará final)
                        return {
                            type: 'warning',
                            data: {
                                product_id: item.product_id,
                                product_name: item.name,
                                requested: item.qty,
                                available,
                                message: msg
                            } as StockWarning
                        };
                    } else {
                        // Offline: Reglas más estrictas
                        if (available <= 0) {
                            // ERROR Bloqueante si stock <= 0
                            return {
                                type: 'error',
                                data: {
                                    product_id: item.product_id,
                                    product_name: item.name,
                                    requested: item.qty,
                                    available,
                                    message: msg
                                } as StockError
                            };
                        } else {
                            // Warning si hay algo de stock pero no suficiente (overselling parcial permitido)
                            return {
                                type: 'warning',
                                data: {
                                    product_id: item.product_id,
                                    product_name: item.name,
                                    requested: item.qty,
                                    available,
                                    message: msg
                                } as StockWarning
                            };
                        }
                    }
                }
                return null;
            });

            const results = await Promise.all(validationPromises);

            results.forEach(res => {
                if (!res) return;
                if (res.type === 'error') {
                    result.valid = false;
                    result.errors.push(res.data as StockError);
                } else {
                    result.warnings.push(res.data as StockWarning);
                }
            });

        } catch (error) {
            console.error('Error validating stock offline:', error);
            // Fail Open: Si falla la validación técnica, permitimos vender
            return { valid: true, warnings: [], errors: [] };
        }

        return result;
    }

    /**
     * Decrementa optimísticamente el stock local después de una venta exitosa (o encolada).
     */
    async decrementLocalStock(
        items: Array<{ product_id: string; qty: number }>,
    ): Promise<void> {
        try {
            await db.transaction('rw', db.localStock, async () => {
                for (const item of items) {
                    const id = `${item.product_id}:null`;
                    const entry = await db.localStock.get(id);

                    if (entry) {
                        await db.localStock.update(id, {
                            stock: entry.stock - item.qty,
                            updated_at: Date.now()
                        });
                    } else {
                        // Si no existe entrada, podríamos crearla con negativo?
                        // Mejor no crear basura si no sabemos el stock inicial.
                    }
                }
            });
        } catch (error) {
            console.error('Error decrementing local stock:', error);
        }
    }
}

export const stockValidatorService = new StockValidatorService();
