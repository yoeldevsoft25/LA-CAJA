
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../src/database/entities/index';

// Supabase URL from .env comments
// postgresql://postgres.unycbbictuwzruxshacq:%40bC154356@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
// NOTE: Must decode params if needed, but connection string usually works as is with TypeORM if compliant.
// However, to be safe, let's use the object config properly if string fails, or just the string.
const SUPABASE_URL = 'postgresql://postgres.unycbbictuwzruxshacq:%40bC154356@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

const AppDataSource = new DataSource({
    type: 'postgres',
    url: SUPABASE_URL,
    ssl: { rejectUnauthorized: false }, // Cloud often needs this
    entities: ALL_ENTITIES,
    synchronize: false,
    logging: false,
});

async function runTriage() {
    try {
        console.log('Initializing DataSource (Supabase)...');
        await AppDataSource.initialize();
        console.log('DataSource initialized.');

        const queries = [
            {
                name: 'Q1: DebtCreated Events (Last 30 days)',
                sql: `SELECT COUNT(*) AS total_events, COUNT(DISTINCT payload->>'debt_id') AS unique_debts FROM events WHERE type IN ('DebtCreated', 'DebtPaymentRecorded', 'DebtPaymentAdded') AND created_at > NOW() - INTERVAL '30 days'`
            },
            {
                name: 'Q2: Debts in Materialized Table (Last 30 days)',
                sql: `SELECT COUNT(*) AS total_debts FROM debts WHERE created_at > NOW() - INTERVAL '30 days'`
            },
            {
                name: 'Q3: Gaps between Events and Projections (Supabase Side)',
                sql: `
            SELECT 
              e.payload->>'debt_id' AS debt_id,
              e.event_id,
              e.type,
              e.device_id,
              e.created_at,
              e.projection_status,
              CASE WHEN d.id IS NOT NULL THEN 'PROJECTED' ELSE 'MISSING' END AS status
            FROM events e
            LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
            WHERE e.type = 'DebtCreated'
              AND e.created_at > NOW() - INTERVAL '30 days'
            ORDER BY e.created_at DESC
            LIMIT 20`
            },
            {
                name: 'Q4: Events via Federation (Where did they come from?)',
                sql: `
            SELECT 
              type, device_id, COUNT(*) AS total
            FROM events
            WHERE type IN ('DebtCreated', 'DebtPaymentRecorded', 'DebtPaymentAdded')
              AND created_at > NOW() - INTERVAL '30 days'
            GROUP BY type, device_id
            ORDER BY total DESC`
            },
            {
                name: 'Q7: Stock Negativo (Overselling check)',
                sql: `SELECT p.name, ws.stock, w.name AS warehouse FROM warehouse_stock ws JOIN products p ON p.id = ws.product_id JOIN warehouses w ON w.id = ws.warehouse_id WHERE ws.stock < 0 LIMIT 10`
            }
        ];

        for (const q of queries) {
            console.log(`\n--- Running ${q.name} ---`);
            const res = await AppDataSource.query(q.sql);
            console.table(res);
        }

    } catch (error) {
        console.error('Error running triage:', error);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

runTriage();
