import { AppDataSource } from '../src/database/data-source';
import * as fs from 'fs';
import * as path from 'path';
import { checkSafeEnvironment } from './_utils/safety';

/**
 * MIGRATION REHEARSAL SCRIPT
 * 
 * Safety Rules:
 * 1. Controlled via scripts/_utils/safety.ts
 * 2. Mode --dry-run skips destructive operations.
 */

const SEED_FILE = path.resolve(__dirname, '../src/database/seed/demo_store_complete.sql');

async function runRehearsal(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    const scenario = process.argv.find(arg => arg === 'data') || 'clean';

    console.log(`🚀 Starting Migration Rehearsal: Scenario ${scenario.toUpperCase()}${isDryRun ? ' (DRY RUN)' : ''}`);

    try {
        // 1. Mandatory Safety Guards
        checkSafeEnvironment('REHEARSAL_DB');

        if (isDryRun) {
            const dbUrl = process.env.DATABASE_URL || '';
            console.log('✨ Dry Run Mode: Validating configuration and plan without changes.');
            console.log(`📡 Would connect to: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
            console.log('✅ Dry Run Completed Successfully.');
            process.exit(0);
        }

        // 2. Initialize DataSource
        console.log('📡 Connecting to database...');
        await AppDataSource.initialize();

        // 3. Clear Database (only for rehearsal)
        console.log('🧹 Clearing database schema...');
        await AppDataSource.dropDatabase();

        // 4. Run Migrations
        console.log('🏗️  Running migrations...');
        await AppDataSource.runMigrations();
        console.log('✅ Migrations completed successfully.');

        // 5. Scenario-specific logic
        if (scenario === 'data') {
            console.log('🌱 Seeding database...');
            if (fs.existsSync(SEED_FILE)) {
                const seedSql = fs.readFileSync(SEED_FILE, 'utf8');
                await AppDataSource.query(seedSql);
                console.log('✅ Seeding completed successfully.');

                console.log('🔍 Verifying data integrity...');
                const eventCountResults = await AppDataSource.query<{ count: string }[]>('SELECT COUNT(*) as count FROM events');
                console.log(`📊 Events found: ${eventCountResults[0].count}`);
            } else {
                console.warn('⚠️ Seed file not found, skipping seeding.');
            }
        }

        console.log('🎉 REHEARSAL PASSED');
        process.exit(0);
    } catch (error) {
        console.error('❌ REHEARSAL FAILED');
        console.error(error instanceof Error ? error.stack || error.message : String(error));
        process.exit(1);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

runRehearsal();
