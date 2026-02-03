# Migration Governance Guide

This guide outlines the standards and procedures for database migrations in the LA-CAJA project.

## Naming Convention

All new migrations must follow this pattern:
`[TYPE][TIMESTAMP]__description.sql`

### Types
- **V (Version/Structural)**: Schema changes (DDL). Create/Alter/Drop tables, indexes, views.
- **D (Data/Operational)**: Data changes (DML). Inserts, updates, deletes for seed data or fixes.

### Timestamp
Use the format `YYYYMMDDHHMMSS` (Centralized time).

### Examples
- `V20260203103000__create_billing_table.sql` (VALID Structural)
- `D20260203103500__seed_tax_regions.sql` (VALID Data)
- `099_emergency_fix.sql` (INVALID - Legacy sequential not allowed for new files)

## Enforcement Policy

The governance is strictly enforced via `scripts/validate-migrations.ts`. CI will FAIL if:
1. A new file uses an invalid naming pattern.
2. A timestamp collision is detected.
3. A `V` file contains DML (e.g., `INSERT INTO`).
4. A `D` file contains DDL (e.g., `CREATE TABLE`).

## Developer Workflow

1. **Locally create the migration**: Use the correct `V` or `D` prefix and current timestamp.
2. **Validate**: Run the validation script locally before pushing.
   ```bash
   npm run validate:migrations --workspace=apps/api
   ```
3. **Rehearse**: Run the upgrade rehearsal (Safe local environment required).
   ```bash
   # See details in migration-upgrade-rehearsal section
   npm run db:rehearsal:upgrade --workspace=apps/api
   ```

## Operational Safety

> [!CAUTION]
> **NEVER** run migration rehearsal scripts (`migration-rehearsal.ts`) against Supabase or any remote production database.

The rehearsal script is destructive and performs a `dropDatabase()`. It is strictly intended for local or ephemeral testing environments. The script has built-in guards that will abort if `DATABASE_URL` contains `supabase`, `render`, or other remote host indicators.

### Rehearsal Command
To run a safe rehearsal locally:
```bash
REHEARSAL_DB=true npx ts-node apps/api/scripts/migration-rehearsal.ts [clean|data]
```

Use `--dry-run` to validate safety checks without modifying your local database.
