# Refactor Clean Command - LA-CAJA

Safely identify and remove dead code with test verification.

## What This Command Does

1. Run dead code analysis tools:
   - knip: Find unused exports and files
   - depcheck: Find unused dependencies
   - ts-prune: Find unused TypeScript exports

2. Generate comprehensive report in `.reports/dead-code-analysis.md`

3. Categorize findings by severity:
   - SAFE: Test files, unused utilities
   - CAUTION: API routes, components, services
   - DANGER: Config files, main entry points, event handlers

4. Propose safe deletions only

5. Before each deletion:
   - Run full test suite
   - Verify tests pass
   - Apply change
   - Re-run tests
   - Rollback if tests fail

6. Show summary of cleaned items

## LA-CAJA Specific

**NEVER REMOVE:**
- Event handlers (event sourcing)
- Sync service code (offline-first)
- Multi-tenant isolation code (store_id filtering)
- CRDT conflict resolution
- Projection code

**SAFE TO REMOVE:**
- Unused DTOs
- Deprecated services
- Old migration files (after verification)
- Unused test utilities

Never delete code without running tests first!

## Related

- Agent: `.cursor/agents/refactor-cleaner.md`
- Rule: `.cursor/rules/coding-style.md`
