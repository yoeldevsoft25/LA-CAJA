# Test Coverage Command - LA-CAJA

Analyze test coverage and generate missing tests.

## What This Command Does

1. Run tests with coverage: `npm test --coverage` or `pnpm test --coverage`

2. Analyze coverage report (`coverage/coverage-summary.json`)

3. Identify files below 80% coverage threshold

4. For each under-covered file:
   - Analyze untested code paths
   - Generate unit tests for functions
   - Generate integration tests for APIs
   - Generate E2E tests for critical flows

5. Verify new tests pass

6. Show before/after coverage metrics

7. Ensure project reaches 80%+ overall coverage

## Focus Areas

- Happy path scenarios
- Error handling
- Edge cases (null, undefined, empty)
- Boundary conditions
- Multi-tenant isolation
- Event generation
- Offline-first sync scenarios

## LA-CAJA Specific

**Critical Coverage Requirements:**
- Event handlers: 100% coverage
- Financial calculations: 100% coverage
- Authentication/authorization: 100% coverage
- Multi-tenant queries: 100% coverage
- Sync service: 80%+ coverage

## Related

- Rule: `.cursor/rules/testing.md`
- Skill: `.cursor/skills/tdd-workflow.md`
- Agent: `.cursor/agents/tdd-guide.md`