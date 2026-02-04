import { db, LocalSale } from '@/db/database';
import { ISaleRepository } from '@/db/repositories/types';

export class DexieSaleRepository implements ISaleRepository {
    async findById(id: string): Promise<LocalSale | undefined> {
        return db.sales.get(id);
    }

    async findAll(): Promise<LocalSale[]> {
        return db.sales.toArray();
    }

    async save(entity: LocalSale): Promise<void> {
        await db.sales.put(entity);
    }

    async saveAll(entities: LocalSale[]): Promise<void> {
        await db.sales.bulkPut(entities);
    }

    async delete(id: string): Promise<void> {
        await db.sales.delete(id);
    }

    async count(): Promise<number> {
        return db.sales.count();
    }

    async getDailySales(storeId: string, timestamp: number): Promise<LocalSale[]> {
        const startOfDay = new Date(timestamp).setHours(0, 0, 0, 0);
        const endOfDay = new Date(timestamp).setHours(23, 59, 59, 999);

        const sales = await db.sales
            .where('[store_id+sold_at]')
            .between([storeId, startOfDay], [storeId, endOfDay])
            .toArray();

        return sales;
    }

    async findByStoreId(storeId: string, limit?: number): Promise<LocalSale[]> {
        // Dexie optimization: reverse() for most recent first if indexed by 'store_id' alone might not be date-ordered.
        // database.ts index: '[store_id+sold_at]'

        const sales = await db.sales
            .where('[store_id+sold_at]')
            .between([storeId, Dexie.minKey], [storeId, Dexie.maxKey])
            .reverse() // Newest first
            .limit(limit || 200) // Default limit
            .toArray();

        return sales;
    }
}

export const saleRepository = new DexieSaleRepository();
import Dexie from 'dexie';
