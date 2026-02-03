# ADR-001: Sync Reliability & Idempotency

## Status
Accepted

## Context
The synchronization pipeline for LA CAJA stores must handle thousands of events under intermittent connectivity. Previous issues included duplicate Sale items, out-of-order customer updates, and untraceable projection job failures.

## Decision
We implement a multi-layered reliability strategy:

1.  **Ingestion Idempotency**: `SyncService` uses `event_id` (PK) for deduplication at the edge.
2.  **Version Awareness (Offline-First)**: Every entity (`Sale`, `Customer`, `CashSession`) now includes an `updated_at` column. Projections MUST skip updates if the event's `created_at` is older than the entity's `updated_at`.
3.  **Transactional Projections**: Complex events like `SaleCreated` are wrapped in a single database transaction to ensure atomicity across items, inventory, and debt.
4.  **Resilient Queues**: BullMQ is configured with exponential backoff (10 attempts for projections) to handle transient database locks or network issues.
5.  **Explicit DLQ Persistence**: Terminal failures are persisted back into the `Event` entity (`projection_status: 'failed'`, `projection_error: '...'`) for permanent auditing and easy manual retry logic.
6.  **Observability**: Real-time metrics track sync latency and failure rates through `SyncMetricsService`.

## Consequences
- Increased database writes for the `Event` status updates.
- Improved traceability: failed projections are now visible in the database instead of just log files.
- Stronger consistency: out-of-order events no longer corrupt modern state.
