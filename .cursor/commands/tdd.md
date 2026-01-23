# TDD Command

Enforce test-driven development workflow. Scaffold interfaces, generate tests FIRST, then implement minimal code to pass. Ensure 80%+ coverage.

## What This Command Does

1. **Scaffold Interfaces** - Define types/interfaces first
2. **Generate Tests First** - Write failing tests (RED)
3. **Implement Minimal Code** - Write just enough to pass (GREEN)
4. **Refactor** - Improve code while keeping tests green (REFACTOR)
5. **Verify Coverage** - Ensure 80%+ test coverage

## When to Use

Use when:
- Implementing new features
- Adding new functions/components
- Fixing bugs (write test that reproduces bug first)
- Refactoring existing code
- Building critical business logic

## TDD Cycle

```
RED → GREEN → REFACTOR → REPEAT

RED:      Write a failing test
GREEN:    Write minimal code to pass
REFACTOR: Improve code, keep tests passing
REPEAT:   Next feature/scenario
```

## LA-CAJA Specific

### Backend (NestJS)
- Use `Test.createTestingModule()` for integration tests
- Test multi-tenant isolation (store_id filtering)
- Test event generation and replay
- Test offline-first sync scenarios

### Frontend (React)
- Use React Testing Library
- Test with React Query providers
- Test offline scenarios
- Test PWA features

### Event Sourcing
- Test event generation
- Test event replay
- Test projections

## Example Workflow

1. Define interface/DTO
2. Write failing test
3. Run test - verify it fails
4. Write minimal implementation
5. Run test - verify it passes
6. Refactor
7. Check coverage (80%+)

## Related

- Skill: `.cursor/skills/tdd-workflow.md`
- Rule: `.cursor/rules/testing.md`
- Role: `@qa`
