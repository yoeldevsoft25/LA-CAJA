
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load env
dotenv.config({ path: join(__dirname, '../apps/api/.env') });

async function diagnose() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'velox_api',
        synchronize: false,
        logging: false,
    });

    await dataSource.initialize();
    console.log('✅ Connected to DB');

    const query = `
    -- Clasificación inicial de gaps de venta/deuda por store
    WITH sale_gaps AS (
      SELECT
        e.event_id,
        e.store_id,
        e.type,
        e.created_at,
        e.projection_status,
        e.projection_error,
        e.payload->>'sale_id' AS entity_id,
        'sale' AS domain
      FROM events e
      LEFT JOIN sales s
        ON s.id = CASE
          WHEN (e.payload->>'sale_id') ~* '^[0-9a-f-]{36}$'
          THEN (e.payload->>'sale_id')::uuid
          ELSE NULL
        END
      WHERE e.type = 'SaleCreated'
        AND e.created_at < NOW() - INTERVAL '1 minute'
        AND e.projection_status IN ('processed', 'failed')
        AND s.id IS NULL
    ),
    debt_gaps AS (
      SELECT
        e.event_id,
        e.store_id,
        e.type,
        e.created_at,
        e.projection_status,
        e.projection_error,
        e.payload->>'debt_id' AS entity_id,
        'debt' AS domain,
        EXISTS (
          SELECT 1
          FROM debts d2
          WHERE d2.store_id = e.store_id
            AND (e.payload->>'sale_id') ~* '^[0-9a-f-]{36}$'
            AND d2.sale_id = (e.payload->>'sale_id')::uuid
        ) AS has_debt_by_sale
      FROM events e
      LEFT JOIN debts d
        ON d.id = CASE
          WHEN (e.payload->>'debt_id') ~* '^[0-9a-f-]{36}$'
          THEN (e.payload->>'debt_id')::uuid
          ELSE NULL
        END
      WHERE e.type = 'DebtCreated'
        AND e.created_at < NOW() - INTERVAL '1 minute'
        AND e.projection_status IN ('processed', 'failed')
        AND d.id IS NULL
    )
    SELECT
      domain,
      projection_status,
      store_id,
      COUNT(*) AS total,
      json_agg(json_build_object(
        'event_id', event_id,
        'error', projection_error,
        'has_debt_by_sale', CASE WHEN domain='debt' THEN has_debt_by_sale ELSE NULL END
      )) as samples
    FROM (
      SELECT domain, projection_status, store_id, event_id, projection_error, NULL::boolean as has_debt_by_sale FROM sale_gaps
      UNION ALL
      SELECT domain, projection_status, store_id, event_id, projection_error, has_debt_by_sale FROM debt_gaps
    ) x
    GROUP BY domain, projection_status, store_id
    ORDER BY domain, projection_status;
  `;

    console.log('🔍 Running diagnostics...');
    const result = await dataSource.query(query);

    console.log(JSON.stringify(result, null, 2));

    await dataSource.destroy();
}

diagnose().catch(console.error);
