import { LocalCustomer } from '@/db/database';
import { IRepository } from '@/db/repositories/types';
import { sqliteService } from '@/services/sqlite.service';

export interface ICustomerRepository extends IRepository<LocalCustomer, string> {
    search(options: { storeId: string, search?: string, limit?: number }): Promise<LocalCustomer[]>;
}

export class SqliteCustomerRepository implements ICustomerRepository {
    private tableName = 'customers';

    async findById(id: string): Promise<LocalCustomer | undefined> {
        const result = await sqliteService.select<{ json_data: string }>(
            `SELECT json_data FROM ${this.tableName} WHERE id = ? LIMIT 1`,
            [id]
        );
        if (result.length === 0) return undefined;
        return JSON.parse(result[0].json_data);
    }

    async findAll(): Promise<LocalCustomer[]> {
        const result = await sqliteService.select<{ json_data: string }>(
            `SELECT json_data FROM ${this.tableName}`
        );
        return result.map(row => JSON.parse(row.json_data));
    }

    async save(entity: LocalCustomer): Promise<void> {
        const query = `
            INSERT OR REPLACE INTO ${this.tableName} 
            (id, store_id, name, document_id, phone, json_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            entity.id,
            entity.store_id,
            entity.name,
            entity.document_id,
            entity.phone,
            JSON.stringify(entity),
            entity.updated_at
        ];
        await sqliteService.execute(query, params);
    }

    async saveAll(entities: LocalCustomer[]): Promise<void> {
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

    async search(options: { storeId: string, search?: string, limit?: number }): Promise<LocalCustomer[]> {
        let query = `SELECT json_data FROM ${this.tableName} WHERE store_id = ?`;
        const params: any[] = [options.storeId];

        if (options.search) {
            // Normalize search in SQL? Or just LIKE
            const term = `%${options.search}%`;
            query += ` AND (name LIKE ? OR document_id LIKE ? OR phone LIKE ?)`;
            params.push(term, term, term);
        }

        query += ` ORDER BY name ASC`;

        if (options.limit) {
            query += ` LIMIT ?`;
            params.push(options.limit);
        }

        const result = await sqliteService.select<{ json_data: string }>(query, params);
        return result.map(row => JSON.parse(row.json_data));
    }
}

export const sqliteCustomerRepository = new SqliteCustomerRepository();
