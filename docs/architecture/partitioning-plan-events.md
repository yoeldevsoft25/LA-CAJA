# Partitioning & Archiving Strategy: `events` Table

## Overview
The `events` table is the heart of the offline-first synchronization mechanism. As the application scales, this table grows linearly, impacting query performance for historical data and sync operations.

## Partitioning Strategy
We will implement **Range Partitioning** based on the `created_at` column.

### Implementation Details
- **Criterion**: Monthly partitions.
- **Naming Convention**: `events_yYYYY_mMM` (e.g., `events_y2026_m02`).
- **Default Partition**: `events_default` to catch any data outside defined ranges.

### Rollout Plan
1. **Phase 1 (Shadow)**: Create a partitioned table `events_p` and start double-writing (or use a trigger). *[Not in this sprint]*
2. **Phase 2 (Migration)**: Migrate historical data in chunks to the new partitioned structure.
3. **Phase 3 (Cutover)**: Rename `events` to `events_old` and `events_p` to `events`.

## Archiving Policy
- **Hot Data**: Last 3 months. Kept in the main database for frequent access and sync.
- **Warm Data**: 3 to 12 months. Kept in partitions but moved to cheaper storage if possible (or just kept as-is if performance allows).
- **Cold Data**: > 12 months. Exported to CSV/Parquet and moved to external storage (S3/GCS). Deleted from the main database.

## Risks & Mitigations
| Risk | Mitigation |
| :--- | :--- |
| Performance hit during migration | Run migration during low-traffic windows using `pg_repack` or similar tools. |
| Breaking historical queries | Ensure all queries include `created_at` in the WHERE clause to enable partition pruning. |
| Unique constraint issues | Primary keys must include the partitioning column (`event_id`, `created_at`). |

## Target Performance Metrics

### Measurable Baseline
The performance will be measured using the following query on a dataset of at least 100,000 events:

```sql
SELECT COUNT(*), type 
FROM events 
WHERE created_at < NOW() - INTERVAL '6 months'
GROUP BY type;
```

- **Goal**: >25% improvement in execution time after partitioning and index optimization.
- **Method**: The `migration-rehearsal.ts` script (Scenario B) captures this metric automatically.

## Detailed Rollout Plan

### Phase 1: Preparation (Local/Staging)
1. Run `db:rehearsal:data` to verify current migration compatibility.
2. Define exact range boundaries for the first 12 months of partitions.

### Phase 2: Schema Migration (Shadow Table)
1. Create `events_partitioned` table with the same schema and monthly partitions.
2. Create a row-level trigger on `events` to replicate all NEW inserts/updates/deletes to `events_partitioned`.
3. Verify data consistency between `events` and `events_partitioned` for new records.

### Phase 3: Historical Data Migration
1. Copy historical data from `events` to `events_partitioned` in chunks of 50,000 rows.
2. Monitor DB load and replication lag during the process.

### Phase 4: Cutover
1. Start a transaction.
2. Lock `events` table (ACCESS EXCLUSIVE).
3. Drop replication trigger.
4. Rename `events` to `events_old`.
5. Rename `events_partitioned` to `events`.
6. Commit transaction.
7. Rebuild any dependent views or foreign keys if necessary.

## Operational Runbook

### Phase 1: Infrastructure Deployment
1. Verify migrations: `npm run migration:run` (Apply `97_prepare_partitioning_events.sql`).
2. Verify partition existence: `SELECT tablename FROM pg_partitions WHERE parentid = 'events_p'::regclass;`.

### Phase 2: Batch Backfill
1. **Security Requirement**: Ensure you are in a local environment. The script will abort if a cloud URL is detected.
2. Start backfill process:
   ```bash
   # Required flags: PARTITIONING_BACKFILL_OK=true
   PARTITIONING_BACKFILL_OK=true npm run db:partitioning:backfill
   ```
3. Use dry-run to validate: `npm run db:partitioning:backfill -- --dry-run`.
4. Monitor progress: `SELECT * FROM partitioning_meta WHERE process_key = 'events_to_events_p';`.
5. Verify data integrity (sample):
   ```sql
   SELECT COUNT(*) FROM events;
   SELECT COUNT(*) FROM events_p;
   ```

> [!CAUTION]
> **PROD-SAFE Allowlist**: The backfill script is strictly prohibited in production or cloud environments (Supabase, Render, AWS).
> It will abort if the `DATABASE_URL` hostname is not one of: `localhost`, `127.0.0.1`, `::1`, `host.docker.internal`, `postgres`.

### Phase 3: Dual-Write (Coming in Sprint 5.3)
1. Apply trigger to replicate new events in real-time.
2. Run final backfill to catch any records missed between Phase 2 and Phase 3.

## Go/No-Go Checklist

| Phase | Check | Criterion |
| :--- | :--- | :--- |
| **Phase 1** | Migration Applied | `events_p` exists in `public` schema. |
| **Phase 1** | Partitions Ready | Partitions for current/next month created. |
| **Phase 2** | Backfill Safety | CPU/Memory usage < 70% during batching. |
| **Phase 2** | Progress Control | `partitioning_meta` updates correctly after each batch. |
| **Phase 4** | Cutover Ready | `events_p` row count == `events` row count. |

## Rollback Operativo

### Emergency Abort (Backfill)
1. Kill the `npm run db:partitioning:backfill` process.
2. The `partitioning_meta` table ensures resumes are safe. No data in `events` is affected.

### System Revert (Post-Cutover)
1. Rename `events` to `events_failed`.
2. Rename `events_old` to `events`.
3. Drop real-time replication trigger.
