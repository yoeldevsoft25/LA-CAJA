import { AppDataSource } from '../src/database/data-source';
import * as fs from 'fs';
import * as path from 'path';
import { checkSafeEnvironment } from './_utils/safety';

/**
 * UPGRADE PATH REHEARSAL SCRIPT
 * 
 * Phases:
 * 1. Baseline: Setup DB up to a specific marker file.
 * 2. Seed: Load demo data.
 * 3. Upgrade: Apply subsequent migrations to HEAD.
 * 4. Verify: Automated integrity checks.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../src/database/migrations');
const SEED_FILE = path.resolve(__dirname, '../src/database/seed/demo_store_complete.sql');

interface VerificationCounts {
    profile_count: string;
    event_count: string;
}

interface ExistsResult {
    exists: boolean;
}

async function runUpgradeRehearsal(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    const baselineMarker = process.env.BASELINE_MARKER_FILE ?? '80_find_all_debt_events_for_sale.sql';

    console.log(`🚀 Starting Upgrade Path Rehearsal${isDryRun ? ' (DRY RUN)' : ''}`);
    console.log(`📍 Using baseline marker: ${baselineMarker}`);

    try {
        // 1. Mandatory Safety Guards
        checkSafeEnvironment('REHEARSAL_DB');

        // 2. Identify and Sort Migrations
        const allMigrations = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const lastBaselineIndex = allMigrations.indexOf(baselineMarker);
        if (lastBaselineIndex === -1) {
            throw new Error(`Baseline marker file "${baselineMarker}" not found in migrations directory.`);
        }

        const baselineMigrations = allMigrations.slice(0, lastBaselineIndex + 1);
        const upgradeMigrations = allMigrations.slice(lastBaselineIndex + 1).filter(file => file !== 'manual_licensing_setup.sql');

        console.log(`📊 Found ${baselineMigrations.length} baseline migrations.`);
        console.log(`📊 Found ${upgradeMigrations.length} upgrade migrations.`);

        if (isDryRun) {
            console.log('\n✨ Execution Plan:');
            console.log(`🔹 [PHASE 1] Execute baseline up to ${baselineMigrations[baselineMigrations.length - 1]}`);
            console.log(`🔹 [PHASE 2] Seed from ${path.basename(SEED_FILE)}`);
            console.log(`🔹 [PHASE 3] Execute upgrade from ${upgradeMigrations[0]} to ${upgradeMigrations[upgradeMigrations.length - 1]}`);
            console.log('✅ Dry Run Completed Successfully.');
            process.exit(0);
        }

        // 3. Phase 1: Baseline Setup
        console.log('\n🏗️  [PHASE 1] Setting up baseline schema...');
        await AppDataSource.initialize();
        await AppDataSource.dropDatabase();

        for (const file of baselineMigrations) {
            process.stdout.write(`  Installing ${file}... `);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            await AppDataSource.query(sql);
            console.log('✅');
        }

        // 4. Phase 2: Seed Data
        console.log('\n🌱 [PHASE 2] Injecting representative seed data...');
        if (fs.existsSync(SEED_FILE)) {
            const seedSql = fs.readFileSync(SEED_FILE, 'utf8');
            await AppDataSource.query(seedSql);
            console.log('✅ Seeding completed.');
        } else {
            console.warn('⚠️ Seed file not found, skipping seeding.');
        }

        // 5. Phase 3: Upgrade Path
        console.log('\n🚀 [PHASE 3] Executing upgrade path to HEAD...');
        for (const file of upgradeMigrations) {
            process.stdout.write(`  Migrating ${file}... `);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            await AppDataSource.query(sql);
            console.log('✅');
        }

        // 6. Phase 4: Verification
        await runVerifications();

        console.log('\n🎉 UPGRADE REHEARSAL PASSED');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ REHEARSAL FAILED');
        console.error(error instanceof Error ? error.stack || error.message : String(error));
        process.exit(1);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

async function runVerifications(): Promise<void> {
    console.log('\n🔍 [PHASE 4] Running automated verifications...');

    // 1. Table existence check
    const tables = ['accounting_periods', 'journal_entries', 'email_verification_tokens', 'events_p'];
    for (const table of tables) {
        const result = await AppDataSource.query<ExistsResult[]>(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `, [table]);
        if (!result[0].exists) throw new Error(`Verification FAILED: Table '${table}' missing after upgrade.`);
        console.log(`  ✅ Table '${table}' exists.`);
    }

    // 2. Column check (License columns in stores - Migration 89)
    const columns = ['license_status', 'license_plan', 'license_expires_at'];
    for (const col of columns) {
        const result = await AppDataSource.query<ExistsResult[]>(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'stores' AND column_name = $1
            );
        `, [col]);
        if (!result[0].exists) throw new Error(`Verification FAILED: Column 'stores.${col}' missing after upgrade.`);
        console.log(`  ✅ Column 'stores.${col}' exists.`);
    }

    // 3. Data Integrity Sanity Check
    const counts = await AppDataSource.query<VerificationCounts[]>(`
        SELECT 
            (SELECT COUNT(*) FROM profiles) as profile_count,
            (SELECT COUNT(*) FROM events) as event_count
    `);
    console.log(`  📊 Data Sanity: ${counts[0].profile_count} profiles, ${counts[0].event_count} events found.`);

    if (parseInt(counts[0].profile_count, 10) === 0) throw new Error('Verification FAILED: Expected seed profiles not found.');
    console.log('✅ Verifications Passed.');
}

runUpgradeRehearsal();
