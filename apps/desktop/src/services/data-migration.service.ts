import { db } from '@/db/database';
import { sqliteProductRepository } from '@/db/repositories/sqlite/product.repository';
import { sqliteSaleRepository } from '@/db/repositories/sqlite/sale.repository';
import { sqliteCustomerRepository } from '@/db/repositories/sqlite/customer.repository';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DataMigrationService');

export const dataMigrationService = {
    async migrateDexieToSqlite() {
        logger.info('Starting data migration from Dexie to SQLite...');
        const start = Date.now();

        try {
            // Products
            const products = await db.products.toArray();
            logger.info(`Migrating ${products.length} products...`);
            await sqliteProductRepository.saveAll(products);

            // Sales
            // Only migrate last 30 days? Or all? Let's do all for now, assuming local DB isn't massive yet.
            // If massive, we should stream.
            const sales = await db.sales.toArray();
            logger.info(`Migrating ${sales.length} sales...`);
            await sqliteSaleRepository.saveAll(sales);

            // Customers
            const customers = await db.customers.toArray();
            logger.info(`Migrating ${customers.length} customers...`);
            await sqliteCustomerRepository.saveAll(customers);

            const duration = Date.now() - start;
            logger.info(`Migration completed in ${duration}ms`);

            // Mark migration as done in localStorage or generic config
            localStorage.setItem('sqlite_migration_v1_completed', 'true');

        } catch (error) {
            logger.error('Migration failed', error);
            throw error;
        }
    }
};
