# Offline Logic & Queue Flushing Reference

## 1. Overview
This document defines the behavior of the "Ferrari" system during network outages. The goal is **zero data loss** (RPO = 0 events lost).

## 2. Core Mechanism: The Sync Queue
When the API cannot reach the external Cloud Relay (Render) or the Main Server:
1.  The event (Sale, Inventory Update, Client Register) is **saved locally** in Postgres (`OfflineQueue` table) and/or Redis (`offline_queue` list).
2.  The API returns `202 Accepted` to the Frontend with a `sync_status: "pending"` flag.
3.  The Frontend stores this transaction in IndexedDB/LocalStorage for UI consistency.

## 3. Connectivity Detection
- **Active Checking**: The `ferrari-healthcheck.ps1` script pings external DNS (8.8.8.8) every 5 minutes.
- **Passive Checking**: The API `SyncService` attempts to send a heartbeat every 30 seconds. If it fails `x3` times, the system enters `OFFLINE_MODE`.

## 4. Recovery & Flush Strategy (The "Flush")
When connectivity is restored (`SyncService` gets `200 OK` from Cloud):

1.  **Locking**: The system acquires a `FLUSH_LOCK` in Redis to prevent concurrent flushes.
2.  **Batching**: Events are read from the queue in batches of 50.
3.  **Sending**: Events are sent to the Cloud API.
4.  **Confirmation**:
    - If Cloud returns `200/201`: Mark local event as `synced` or Delete from Queue.
    - If Cloud returns `409 Conflict`: Log error, move to `DeadLetterQueue` (manual intervention).
    - If Cloud returns `5xx`: Retry later (Exponential Backoff).
5.  **Unlock**: Release `FLUSH_LOCK`.

## 5. Idempotency
**CRITICAL**: Every offline event MUST have a `UUID` generated at creation time (on the User's device or Local API).
- The Cloud API uses this UUID to ignore duplicates if the Flush retries a batch that partially succeeded.

## 6. Frontend Responsibility
- The UI should display a "Syncing..." cloud icon when connectivity returns.
- It should poll `/sync/status` to know when the flush is complete.
