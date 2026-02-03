import { AppDataSource } from '../src/database/data-source';
import { checkSafeEnvironment } from './_utils/safety';

const PROCESS_KEY = 'events_to_events_p';
const DEFAULT_BATCH_SIZE = 5000;

interface PartitioningMeta {
    process_key: string;
    last_created_at: Date | null;
    last_event_id: string | null;
    records_processed: string; // BIGINT as string from pg
    is_active: boolean;
    metadata: {
        batch_size?: number;
    };
}

interface EventRow {
    event_id: string;
    store_id: string;
    device_id: string;
    seq: string;
    type: string;
    version: number;
    created_at: Date;
    actor_user_id: string | null;
    actor_role: string | null;
    payload: Record<string, unknown>;
    received_at: Date;
    vector_clock: Record<string, number>;
    causal_dependencies: string[];
    conflict_status: string;
    delta_payload: Record<string, unknown> | null;
    full_payload_hash: string | null;
}

async function runBackfill(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`🚀 Starting Events Partitioning Backfill${isDryRun ? ' (DRY RUN)' : ''}...`);

    try {
        // 1. Mandatory Safety Guards
        checkSafeEnvironment('PARTITIONING_BACKFILL_OK');

        await AppDataSource.initialize();

        // 2. Get progress
        const metaResults = await AppDataSource.query<PartitioningMeta[]>(`
      SELECT process_key, last_created_at, last_event_id, records_processed, is_active, metadata 
      FROM partitioning_meta 
      WHERE process_key = $1
    `, [PROCESS_KEY]);

        if (!metaResults || metaResults.length === 0) {
            throw new Error(`Meta record for ${PROCESS_KEY} not found. Ensure Phase 1 migration was applied.`);
        }

        const { last_created_at, last_event_id, records_processed, metadata } = metaResults[0];
        const batchSize = metadata?.batch_size || DEFAULT_BATCH_SIZE;

        console.log(`📊 Current Progress: ${records_processed} records processed.`);
        console.log(`🔍 Last record: ${last_created_at ? last_created_at.toISOString() : 'START'} (${last_event_id || 'NONE'})`);

        // 3. Fetch batch
        let query = `SELECT * FROM events`;
        const paramsList: (string | number | Date)[] = [];

        if (last_created_at && last_event_id) {
            query += ` WHERE (created_at, event_id) > ($1, $2) `;
            paramsList.push(last_created_at, last_event_id);
        }

        query += ` ORDER BY created_at ASC, event_id ASC LIMIT $${paramsList.length + 1}`;
        paramsList.push(batchSize);

        const batch = await AppDataSource.query<EventRow[]>(query, paramsList);

        if (batch.length === 0) {
            console.log('✅ Backfill complete! No more records to process.');
            process.exit(0);
        }

        console.log(`📦 Found ${batch.length} records to process.`);

        if (isDryRun) {
            console.log('✨ Dry Run: No records will be inserted.');
            console.log(`🔹 First record in batch: ${batch[0].created_at.toISOString()} (${batch[0].event_id})`);
            console.log(`🔹 Last record in batch: ${batch[batch.length - 1].created_at.toISOString()} (${batch[batch.length - 1].event_id})`);
            console.log('✅ Dry Run Completed Successfully.');
            process.exit(0);
        }

        // 4. Insert into events_p
        await AppDataSource.transaction(async (transactionManager) => {
            for (const row of batch) {
                const columns = Object.keys(row).join(', ');
                const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(', ');
                const values = Object.values(row);

                await transactionManager.query(`
          INSERT INTO events_p (${columns}) 
          VALUES (${placeholders})
          ON CONFLICT (event_id, created_at) DO NOTHING
        `, values);
            }

            // 5. Update progress
            const lastRow = batch[batch.length - 1];
            await transactionManager.query(`
        UPDATE partitioning_meta 
        SET last_created_at = $1, 
            last_event_id = $2, 
            records_processed = records_processed + $3,
            updated_at = NOW()
        WHERE process_key = $4
      `, [lastRow.created_at, lastRow.event_id, batch.length, PROCESS_KEY]);
        });

        console.log(`✨ Batch finished. New total: ${Number(records_processed) + batch.length}`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Backfill error:');
        console.error(error instanceof Error ? error.stack || error.message : String(error));
        process.exit(1);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

runBackfill();
