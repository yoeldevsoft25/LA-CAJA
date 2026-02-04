import { LocalSale } from '@/db/database';
import { ISaleRepository } from '@/db/repositories/types';
import { sqliteService } from '@/services/sqlite.service';

export class SqliteSaleRepository implements ISaleRepository {
    private tableName = 'sales';

    async findById(id: string): Promise<LocalSale | undefined> {
        const result = await sqliteService.select<{ json_data: string }>(
            `SELECT json_data FROM ${this.tableName} WHERE id = ? LIMIT 1`,
            [id]
        );
        if (result.length === 0) return undefined;
        return JSON.parse(result[0].json_data);
    }

    async findAll(): Promise<LocalSale[]> {
        const result = await sqliteService.select<{ json_data: string }>(
            `SELECT json_data FROM ${this.tableName} ORDER BY sold_at DESC`
        );
        return result.map(row => JSON.parse(row.json_data));
    }

    async save(entity: LocalSale): Promise<void> {
        const query = `
            INSERT OR REPLACE INTO ${this.tableName} 
            (id, store_id, sold_at, total_usd, total_bs, payment_method, json_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        // Extract plain values for indexing
        // Assuming totals might be strings in Dexie land, convert to numbers for SQL sorting/filtering
        const totalUsd = typeof entity.totals.total_usd === 'string' ? parseFloat(entity.totals.total_usd) : entity.totals.total_usd;
        const totalBs = typeof entity.totals.total_bs === 'string' ? parseFloat(entity.totals.total_bs) : entity.totals.total_bs;

        const params = [
            entity.id,
            entity.store_id,
            entity.sold_at, // Assuming number/timestamp
            totalUsd,
            totalBs,
            entity.payment.method,
            JSON.stringify(entity)
        ];
        await sqliteService.execute(query, params);
    }

    async saveAll(entities: LocalSale[]): Promise<void> {
        for (const entity of entities) {
            await this.save(entity);
        }
    }

    async delete(id: string): Promise<void> {
        await sqliteService.execute(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
    }

    async count(): Promise<number> {
        const result = await sqliteService.select<{ count: number }>(
            `SELECT COUNT(*) as count FROM ${this.tableName}`
        );
        return result[0]?.count || 0;
    }

    async findByStoreId(storeId: string, limit?: number): Promise<LocalSale[]> {
        let query = `SELECT json_data FROM ${this.tableName} WHERE store_id = ? ORDER BY sold_at DESC`;
        const params: any[] = [storeId];

        if (limit) {
            query += ` LIMIT ?`;
            params.push(limit);
        }

        const result = await sqliteService.select<{ json_data: string }>(query, params);
        return result.map(row => JSON.parse(row.json_data));
    }
}

export const sqliteSaleRepository = new SqliteSaleRepository();
