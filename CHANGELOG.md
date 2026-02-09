
# Changelog

## [1.5.0] - 2026-02-09

### Added - Split Brain Remediation & Federation System

#### Core Infrastructure
- **Outbox Pattern**: Added `outbox_entries` table and `OutboxService` to guarantee atomic event processing and relay.
- **Orphan Healer**: Automatic detection and repair of projection gaps (missing sales/debts).
- **Distributed Lock**: Added Redis-based locking for singleton cron jobs across pods.
- **Circuit Breaker**: Added resilience for remote federation calls.

#### Inventory & Sales
- **Escrow Service**: Products now reserve quotas ("escrow") before offline usage to prevent overselling.
- **Soft Validation**: Server warns but accepts overselling in critical paths (Fail Open).
- **Deterministic Hashing**: Deep sort of JSON payloads before SHA-256 calculation for drift detection.

#### Fiscal Compliance
- **Fiscal Ranges**: `FiscalSequenceService` manages pre-assigned invoice number blocks per device.
- **Strict Validation**: Server rejects duplicate fiscal numbers.

#### Observability
- **Health Monitoring**: `SplitBrainMonitorService` tracks system vitals every 5 minutes.
- **Alerting**: Automated alerts for `Critical`, `Projection Gaps`, `Overselling`, and `Fiscal Duplicates`.
- **Conflict Audit**: Logs all automatic CRDT resolutions.

### Technical Updates
- **Dependencies**: Added `@nestjs/bullmq`, `ioredis`.
- **Database**: 
  - `migrations/add_outbox_and_audit_tables.sql`
  - `migrations/add_fiscal_ranges.sql`
  - `migrations/add_federation_health.sql`

## [1.4.0]
- Previous Release...
