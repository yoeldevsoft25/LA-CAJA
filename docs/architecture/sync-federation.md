
# Architecture: Sync & Federation

This document describes the synchronization architecture for Velox POS, focusing on the changes made to support robust multi-master replication (Split Brain Remediation).

## Overview

The system uses an **Event Sourcing** approach with **Vector Clocks** for causal ordering and **CRDTs** (Conflict-free Replicated Data Types) for automatic conflict resolution.

### Core Flows

1.  **Local Changes (PWA)**:
    - User performs action (Sale, Inventory Adjustment).
    - Event created locally (IndexedDB).
    - Optimistic UI update.
    - Background Sync pushes event to server (`POST /sync/push`).

2.  **Server Processing (API)**:
    - **Validation**: Basic schema checks.
    - **Fiscal Check**: Verify fiscal number uniqueness and range validity.
    - **Stock Check (Soft Mode)**: Warn on overselling, do not block.
    - **Deduplication**: Idempotency checks via `event_id` and Vector Clocks.
    - **Conflict Detection**: Check `vector_clock` for concurrent updates.
    - **Persistence**: Save event to `events` table.
    - **Outbox**: Write to `outbox_entries` in the SAME transaction.

3.  **Outbox Processor**:
    - Periodically (3s) reads pending entries.
    - **Projections**: Updates materialized views (`sales`, `warehouse_stock`).
    - **Federation Relay**: Queues events for remote sync if enabled.

4.  **Federation Relay**:
    - Uses `BullMQ` for reliable delivery.
    - **Circuit Breaker**: Protects against cascading failures if remote is down.
    - **Priority Queue**: Ensures causal ordering (e.g., maintain `CashSession` before `Sale`).
    - Pushes to Remote Node (`POST /sync/push`).

## Data Structures

### Event
- `event_id`: UUID
- `type`: String (SaleCreated, StockAdjusted, etc.)
- `seq`: Monotonic integer per device
- `vector_clock`: Map { device_id: seq }
- `payload`: JSON
- `full_payload_hash`: SHA-256 (Deterministic Deep Sort)
- `delta_payload`: JSON (CRDT Delta)

### CRDT Strategies

| Entity | Strategy | Notes |
| :--- | :--- | :--- |
| **Sales** | AWSet (Add-Wins Set) | Sales are immutable once created. Voids are separate events. |
| **Inventory** | GCounter / PN-Counter (Simulated) | Stock is sum of movements. |
| **Products** | LWW (Last-Write-Wins) | Last update based on wall clock time wins. |
| **Customers** | LWW | Last update wins. |
| **Debts** | AWSet | Debts and Payments are additive. |

## Federation Logic

### Split Brain Remediation
- **Health Monitoring**: `SplitBrainMonitorService` tracks lag, gaps, and divergence.
- **Alerting**: Automated alerts for critical health issues.
- **Reconciliation**: `FederationSyncService` periodically compares event logs using Merkle Tree-like logic (though implemented as time-window queries for V1).
- **Distributed Lock**: Ensures only one node runs reconciliation at a time.

### Fiscal Safety
- **Pre-assigned Ranges**: Devices reserve blocks of 50 numbers.
- **Strict Check**: Server validates incoming fiscal numbers against assigned ranges.
- **Audit**: Duplicate numbers trigger P0 alerts.

## Infrastructure

- **Queue**: BullMQ (Redis) for async processing.
- **Database**: PostgreSQL (Supabase + Local).
- **Lock**: Redis-based distributed lock (`SET NX PX`).
- **Circuit Breaker**: In-memory state machine for remote HTTP calls.

