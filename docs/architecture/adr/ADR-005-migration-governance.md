# ADR-005: Migration Governance

## Status
Accepted

## Enforcement Rules
To ensure strict compliance with this governance, the following rules are enforced via automated scripts:
1. **Hard Fail on New Convention Violations**: Any new migration file (timestamp-based) that does not follow the `[V|D]YYYYMMDDHHMMSS__description.sql` pattern will cause the CI to fail.
2. **Hard Fail on Version Collisions**: If two migrations share the same timestamp (or normalized decimal prefix for legacy), the validator will abort.
3. **Strict Separation of Concerns**: 
   - `V` (Structural) files must NOT contain DML (`INSERT`, `UPDATE`, `DELETE`).
   - `D` (Data) files must NOT contain DDL (`CREATE`, `ALTER`, `DROP`).
4. **Controlled Legacy Support**: Existing sequential migrations are tolerated with warnings to allow for a gradual transition, but no new sequential files are permitted.

## Operational Safety (Supabase)
Executing destructive scripts (like `dropDatabase()` or `synchronize(true)`) against production environments, particularly Supabase, is strictly prohibited. The automated rehearsal scripts must include hard guards to detect and abort if a remote database URL is present.

## Context
The current migration system in `apps/api` uses a sequential numbering system (`XX_description.sql`). As the team grows and multiple features are developed in parallel, this system is prone to version collisions (multiple developers using the same number). Additionally, there is no formal separation between structural schema changes and operational data fixes.

## Decision
We will implement a robust migration governance system with the following rules:

1. **Versioning**: Use a 14-digit timestamp (`YYYYMMDDHHMMSS`) to ensure uniqueness across distributed teams.
2. **Types**:
    - **Structural (V)**: Prefixed with `V`, contains only Schema Definition Language (SDL) like `CREATE`, `ALTER`, `DROP`.
    - **Data Fix (D)**: Prefixed with `D`, contains Data Manipulation Language (DML) like `INSERT`, `UPDATE`, `DELETE`.
3. **Naming Pattern**: `[V|D]YYYYMMDDHHMMSS__description.sql`.
4. **Validation**: An automated script will run in CI and locally to enforce these rules and prevent collisions.

## Consequences
- **Pros**: Reduced merge conflicts, clear separation of concerns, easier auditing of data changes vs schema changes.
- **Cons**: Longer filenames, manual renaming if timestamps collide (rare), legacy migrations need to be exempted until refactored.
