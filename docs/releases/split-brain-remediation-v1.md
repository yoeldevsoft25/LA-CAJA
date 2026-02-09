
# Release Notes: Split Brain Remediation v1

**Date:** 2026-02-09
**Version:** 1.5.0

## Executive Summary

This release introduces a comprehensive suite of features designed to detect, prevent, and remediate "split-brain" scenarios in the Velox POS distributed environment. The primary goal is to ensure data consistency (especially fiscal and inventory) across offline-first devices and the central server.

## Key Features

### 🛡️ Defensive Layer
- **Outbox Pattern:** Guaranteed atomic execution of database writes and federation events.
- **Circuit Breaker:** Fails fast when remote nodes are unreachable, preventing resource exhaustion.
- **Distributed Lock:** Ensures safe execution of critical singleton processes (reconciliation).

### ⚖️ Consistency & Integrity
- **Inventory Escrow:** Pre-reservation of stock quotas for offline devices to prevent overselling.
- **Fiscal Ranges:** Strict assignment of invoice number blocks to continuous offline operations without collision.
- **Auto-Healing:** `OrphanHealerService` automatically repairs data inconsistencies (projection gaps).
- **Deterministic Hashing:** Deep inspection of data payloads to detect true drift.

### 👁️ Observability
- **Health Dashboard API:** Real-time visibility into sync lag, conflicts, and system health.
- **Automated Alerts:** Instant notification for critical issues like fiscal duplicates or massive lag.
- **Conflict Auditing:** Full traceability of automatic conflict resolutions (CRDTs).

## Metrics & Success Criteria

| Metric | Before | After (Target) |
| :--- | :--- | :--- |
| **Fiscal Duplicates** | Occasional | 0 (Strict Prevention) |
| **Overselling** | Unbounded | < 1% (Managed via Escrow) |
| **Projection Gaps** | Permanent until manual fix | Auto-healed in < 5 mins |
| **Sync Reliability** | Flaky on weak network | Resilient (Circuit Breaker) |

## Known Limitations

- **Complex Conflicts:** Manual resolution UI is not yet implemented for conflicts that automated CRDTs cannot safely handle (currently flagged as `requires_manual_review`).
- **Escrow Fragmentation:** Highly theoretical edge case where stock is locked in inactive devices (mitigated by 4h expiration).

## Rollout Plan

1.  **Staging Deployment**: Validate with Chaos Test Suite.
2.  **Canary Release**: Deploy to Pilot Store (Store ID: `pilot-001`).
3.  **General Availability**: Progressive rollout to all stores over 48h.

## Future Work

- UI for manual conflict resolution.
- Peer-to-Peer sync via local WebRTC (Phase 7 idea).
- Advanced analytics on conflict rates.
