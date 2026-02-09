
# Split Brain Mitigations

This document details the specific mitigations implemented to handle split-brain scenarios and data divergence between local and remote nodes.

## Core Mitigations

### 1. Orphan Healer Service (Automatic Repair)
- **Problem**: Events saved correctly but projection failing (e.g., due to temporary DB lock or bug), leaving data invisible in reports.
- **Solution**: Cron job every minute scans for events without corresponding entities in materialized tables.
- **Action**: Reprojects the event automatically.
- **Metric**: `projection_gap_count`

### 2. Outbox Pattern (Atomic Consistency)
- **Problem**: Dual-write problem where event is saved but projection/relay fails due to process crash.
- **Solution**: Write intent to `outbox_entries` table in the SAME transaction as the event.
- **Action**: Background worker processes entries reliably.
- **Guarantee**: At-least-once delivery.

### 3. Inventory Escrow (Overselling Prevention)
- **Problem**: Multiple offline devices selling same stock item leading to negative inventory.
- **Solution**: Devices reserve stock quotas ("escrow") before going offline.
- **Action**: Offline sales consume from local quota. If quota empty, sale blocked (or warned in Soft Mode).
- **Metric**: `negative_stock_count`

### 4. Fiscal Ranges (Legal Compliance)
- **Problem**: Offline devices generating same invoice number.
- **Solution**: Pre-assigned non-overlapping ranges (e.g., Device A: 1-50, Device B: 51-100).
- **Action**: Strict validation on sync.
- **Metric**: `fiscal_duplicate_count`

### 5. Circuit Breaker (Resilience)
- **Problem**: Remote outage causes request pile-up and resource exhaustion.
- **Solution**: Stop sending requests after thresholds (5 failures).
- **Action**: Queue requests for later retry (Exponential Backoff).
- **State**: `CLOSED` -> `OPEN` -> `HALF_OPEN`.

### 6. Distributed Lock (Concurrency Safety)
- **Problem**: Multiple API pods running reconciliation simultaneously causing race conditions and duplicates.
- **Solution**: Redis-based distributed lock (`federation:reconcile:{storeId}`).
- **Action**: Ensure only one leader performs reconciliation.

### 7. Deterministic Deep Hash (Data Integrity)
- **Problem**: JSON key ordering differences causing false positive data drift alerts.
- **Solution**: Recursive sort of keys before hashing payload.
- **Action**: Compare `full_payload_hash` across nodes.

### 8. Causal Relay Ordering (Logical Consistency)
- **Problem**: `SaleCreated` arriving before its `CashSessionOpened` causing rejection.
- **Solution**: Priority queues in BullMQ.
- **Priorities**: Session (1) > Product/Customer (3) > Debt (4) > Sale (5).

## Monitoring & Alerting

- **Health Endpoint**: `GET /sync/federation/health` provides real-time status.
- **Alerts**:
  - `FEDERATION_CRITICAL`: Overall system failure.
  - `PROJECTION_GAP_DETECTED`: Automated repair needed/failed.
  - `OVERSELLING_DETECTED`: Action required.
  - `FISCAL_DUPLICATE`: Immediate P0 action.
