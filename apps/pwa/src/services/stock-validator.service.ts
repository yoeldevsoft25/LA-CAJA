import { db } from '@la-caja/app-core';

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
            for (const item of items) {
                // 1. Obtener producto para ver si trackea inventario (usando cache local de productos)
                // Nota: Si no está en cache, asumimos que NO trackea inventario (Fail Open)
                const product = await db.products.get(item.product_id);

                // Si es un servicio o no trackea stock, skip
                // TODO: Ajustar lógica si 'product_type' define esto
                if (product && product.product_type === 'prepared') {
                    continue;
                }

                // 2. Obtener stock local
                // ID compuesto product_id:variant_id (variant es null por ahora)
                const stockEntry = await db.localStock.get(`${item.product_id}:null`);
                const available = stockEntry ? stockEntry.stock : 0;

                // 3. Validar
                if (available < item.qty) {
                    const msg = `Stock insuficiente: ${available} disponible, ${item.qty} solicitado.`;

                    if (isOnline) {
                        // Online: Warning (Fail Open, el server validará final)
                        result.warnings.push({
                            product_id: item.product_id,
                            product_name: item.name,
                            requested: item.qty,
                            available,
                            message: msg
                        });
                    } else {
                        // Offline: Reglas más estrictas
                        if (available <= 0) {
                            // ERROR Bloqueante si stock <= 0
                            result.valid = false;
                            result.errors.push({
                                product_id: item.product_id,
                                product_name: item.name,
                                requested: item.qty,
                                available,
                                message: msg
                            });
                        } else {
                            // Warning si hay algo de stock pero no suficiente (overselling parcial permitido)
                            result.warnings.push({
                                product_id: item.product_id,
                                product_name: item.name,
                                requested: item.qty,
                                available,
                                message: msg
                            });
                        }
                    }
                }
            }
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
