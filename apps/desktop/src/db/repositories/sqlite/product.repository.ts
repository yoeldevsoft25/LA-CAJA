import { LocalProduct } from '@/db/database';
import { IProductRepository, ProductFilterOptions } from '@/db/repositories/types';
import { sqliteService } from '@/services/sqlite.service';

export class SqliteProductRepository implements IProductRepository {
    private tableName = 'products';

    async findById(id: string): Promise<LocalProduct | undefined> {
        const result = await sqliteService.select<{ json_data: string }>(
            `SELECT json_data FROM ${this.tableName} WHERE id = ? LIMIT 1`,
            [id]
        );
        if (result.length === 0) return undefined;
        return JSON.parse(result[0].json_data);
    }

    async findAll(): Promise<LocalProduct[]> {
        const result = await sqliteService.select<{ json_data: string }>(
            `SELECT json_data FROM ${this.tableName}`
        );
        return result.map(row => JSON.parse(row.json_data));
    }

    async save(entity: LocalProduct): Promise<void> {
        const query = `
            INSERT OR REPLACE INTO ${this.tableName} 
            (id, store_id, name, sku, barcode, category, is_active, json_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            entity.id,
            entity.store_id,
            entity.name,
            entity.sku,
            entity.barcode,
            entity.category,
            entity.is_active ? 1 : 0,
            JSON.stringify(entity),
            entity.updated_at
        ];
        await sqliteService.execute(query, params);
    }

    async saveAll(entities: LocalProduct[]): Promise<void> {
        // SQLite doesn't have a simple bulk insert like Dexie, so we loop transactions or use building insert
        // For simplicity and safety with placeholders, we'll loop for now. 
        // Optimization: build a single huge INSERT statement or use transactions.
        // Since sqliteService.execute doesn't expose transactions directly yet, we loop.
        // Phase 4 will introduce proper transaction support.

        // However, for performance, we should at least try to batch slightly if possible or assume the underlying plugin handles it.
        // Let's do a loop for now, it's safer than constructing massive strings manually.
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

    async search(options: ProductFilterOptions & { storeId: string }): Promise<LocalProduct[]> {
        let query = `SELECT json_data FROM ${this.tableName} WHERE store_id = ?`;
        const params: any[] = [options.storeId];

        if (options.is_active !== undefined) {
            query += ` AND is_active = ?`;
            params.push(options.is_active ? 1 : 0);
        }

        if (options.category) {
            query += ` AND category = ?`;
            params.push(options.category);
        }

        // Note: product_type and is_visible_public might not be columns, so we might need to filter in memory
        // if they are not indexed. But for "shine" performance, we should filter as much as possible in SQL.
        // We didn't add product_type to schema yet. Let's filter in memory for those non-indexed fields if needed,
        // OR rely on the fact that JSON_EXTRACT is available in SQLite but might be slower without index.
        // Taking Hybrid approach: Filter what we can in SQL, rest in memory.

        if (options.search) {
            const term = `%${options.search}%`;
            query += ` AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)`;
            params.push(term, term, term);
        }

        query += ` ORDER BY name ASC`;

        if (options.limit) {
            query += ` LIMIT ?`;
            params.push(options.limit);
        }

        const result = await sqliteService.select<{ json_data: string }>(query, params);
        let products = result.map(row => JSON.parse(row.json_data) as LocalProduct);

        // In-memory filter for non-indexed fields
        if (options.product_type) {
            products = products.filter(p => p.product_type === options.product_type);
        }
        if (options.is_visible_public !== undefined) {
            products = products.filter(p => p.is_visible_public === options.is_visible_public);
        }

        return products;
    }

    async findByBarcode(barcode: string): Promise<LocalProduct[]> {
        const result = await sqliteService.select<{ json_data: string }>(
            `SELECT json_data FROM ${this.tableName} WHERE barcode = ?`,
            [barcode]
        );
        return result.map(row => JSON.parse(row.json_data));
    }

    async findByStoreId(storeId: string, onlyActive?: boolean): Promise<LocalProduct[]> {
        let query = `SELECT json_data FROM ${this.tableName} WHERE store_id = ?`;
        const params: any[] = [storeId];

        if (onlyActive) {
            query += ` AND is_active = 1`;
        }

        const result = await sqliteService.select<{ json_data: string }>(query, params);
        return result.map(row => JSON.parse(row.json_data));
    }
}

export const sqliteProductRepository = new SqliteProductRepository();
