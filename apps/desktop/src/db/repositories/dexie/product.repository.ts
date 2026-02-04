import { db, LocalProduct } from '@/db/database';
import { IProductRepository, ProductFilterOptions } from '@/db/repositories/types';

export class DexieProductRepository implements IProductRepository {
    async findById(id: string): Promise<LocalProduct | undefined> {
        return db.products.get(id);
    }

    async findAll(): Promise<LocalProduct[]> {
        return db.products.toArray();
    }

    async save(entity: LocalProduct): Promise<void> {
        await db.products.put(entity);
    }

    async saveAll(entities: LocalProduct[]): Promise<void> {
        await db.products.bulkPut(entities);
    }

    async delete(id: string): Promise<void> {
        await db.products.delete(id);
    }

    async count(): Promise<number> {
        return db.products.count();
    }

    async search(options: ProductFilterOptions & { storeId: string }): Promise<LocalProduct[]> {
        let query = db.products.where('store_id').equals(options.storeId);

        if (options?.is_active !== undefined) {
            query = query.filter(p => p.is_active === options.is_active);
        }

        if (options?.is_visible_public !== undefined) {
            query = query.filter(p => p.is_visible_public === options.is_visible_public);
        }

        if (options?.product_type) {
            query = query.filter(p => p.product_type === options.product_type);
        }

        if (options?.category) {
            query = query.filter(p => p.category === options.category);
        }

        if (options?.search) {
            const searchLower = options.search.toLowerCase();
            query = query.filter(p => {
                const nameMatch = p.name.toLowerCase().includes(searchLower);
                const skuMatch = p.sku?.toLowerCase().includes(searchLower) ?? false;
                const barcodeMatch = p.barcode?.toLowerCase().includes(searchLower) ?? false;
                return nameMatch || skuMatch || barcodeMatch;
            });
        }

        const products = await query.toArray();

        // Ordenar por nombre
        products.sort((a, b) => a.name.localeCompare(b.name));

        if (options?.limit) {
            return products.slice(0, options.limit);
        }

        return products;
    }

    async findByBarcode(barcode: string): Promise<LocalProduct[]> {
        return db.products.where('barcode').equals(barcode).toArray();
    }

    async findByStoreId(storeId: string, onlyActive?: boolean): Promise<LocalProduct[]> {
        if (onlyActive) {
            try {
                // Intento usar índice compuesto si está disponible
                // Nota: Dexie maneja booleanos como 0/1 en índices a veces, o simplemente como booleanos
                // Depende del adaptador subyacente, pero para seguridad usamos el fallback si falla
                return await db.products
                    .where('[store_id+is_active]')
                    .equals([storeId, 1]) // 1 = true
                    .toArray();
            } catch (e) {
                // Fallback a filtrado en memoria
                return db.products
                    .where('store_id')
                    .equals(storeId)
                    .filter(p => p.is_active === true)
                    .toArray();
            }
        }
        return db.products.where('store_id').equals(storeId).toArray();
    }
}

export const productRepository = new DexieProductRepository();
