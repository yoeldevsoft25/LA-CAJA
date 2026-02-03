# Sprint 6.1A Closure - Backend Reliability Hardening

## Scope Closed

- Sync projection reliability for `SaleCreated` flow.
- Queue-level completeness checks for idempotent skip/repair decisions.
- Tenant-safe guards in debt and movement checks.
- Type hardening in projection payload normalization.

## Final Hardening Decisions

1. **Strict tenant isolation**
   - Debt idempotency checks now use `sale_id + store_id` (projection and queue paths).
   - Movement completeness checks include `store_id` filter.

2. **Deterministic payload normalization**
   - Added normalization helpers in `ProjectionsService`:
     - `toBoolean`
     - `toNumber`
     - `toNullableNumber`
     - `toSaleTotals`
     - `toSalePayment`
   - Prevents runtime drift from mixed payload types (`boolean | number | string`).

3. **Atomicity preservation**
   - `SaleCreated` projection keeps inventory and debt side effects inside the same transaction.
   - `updateStockBatch` remains transaction-bound through shared `EntityManager`.

4. **Queue completion correctness**
   - Event early-skip path now marks:
     - `projection_status = 'processed'`
     - `projection_error = null`
   - Ensures no stale error remains after successful skip.

## Validation Evidence

- `npm run test --workspace=apps/api -- projections.final-hardening` -> **PASS (4/4)**
- `npx eslint apps/api/src/projections/projections.service.ts apps/api/src/sales/queues/sales-projection.queue.ts apps/api/src/sync/dto/sync-types.ts` -> **PASS**
- `npm run build --workspace=apps/api` -> **PASS**
- `npm run lint:ratchet` -> **PASS**

## Files Included In This Closure

- `apps/api/src/projections/projections.service.ts`
- `apps/api/src/sales/queues/sales-projection.queue.ts`
- `apps/api/src/sync/dto/sync-types.ts`
- `apps/api/src/projections/projections.final-hardening.spec.ts`

