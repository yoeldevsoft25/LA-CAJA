# TDD Workflow - LA-CAJA

## Test-Driven Development Cycle

```
RED → GREEN → REFACTOR → REPEAT

RED:      Write a failing test
GREEN:    Write minimal code to pass
REFACTOR: Improve code, keep tests passing
REPEAT:   Next feature/scenario
```

## MANDATORY Workflow

1. **Define Interfaces First** (SCAFFOLD)
   - Define TypeScript interfaces/types
   - Define function signatures
   - Define DTOs with validation

2. **Write Failing Test** (RED)
   - Write test that will FAIL
   - Test behavior, not implementation
   - Include edge cases

3. **Run Test - Verify FAIL**
   - Test should fail for the right reason
   - Error message should be clear

4. **Write Minimal Implementation** (GREEN)
   - Write just enough code to pass
   - Don't over-engineer
   - Focus on making test pass

5. **Run Test - Verify PASS**
   - All tests should pass
   - Verify coverage

6. **Refactor** (IMPROVE)
   - Improve code quality
   - Keep tests passing
   - Extract utilities
   - Improve naming

7. **Verify Coverage** (80%+)
   - Check test coverage
   - Add more tests if needed
   - Aim for 100% for critical code

## Test Types

### Unit Tests
- Individual functions, utilities, components
- Fast, isolated, no dependencies
- Use mocks for external dependencies

### Integration Tests
- API endpoints, database operations
- Test with real database (test DB)
- Use `Test.createTestingModule()` in NestJS

### E2E Tests
- Critical user flows
- Use Playwright
- Test full stack integration

## LA-CAJA Specific Testing

### Backend (NestJS)
```typescript
describe('ProductsService', () => {
  let service: ProductsService
  let repository: Repository<Product>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<ProductsService>(ProductsService)
    repository = module.get<Repository<Product>>(getRepositoryToken(Product))
  })

  it('should filter by store_id', async () => {
    // Test multi-tenant isolation
  })
})
```

### Frontend (React)
```typescript
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

describe('ProductsPage', () => {
  it('should display products', async () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsPage />
      </QueryClientProvider>
    )
    // Test assertions
  })
})
```

### Event Sourcing Tests
- Test event generation
- Test event replay
- Test projections

### Offline-First Tests
- Test offline scenarios
- Test sync conflicts
- Test cache behavior

## Coverage Requirements

- **80% minimum** for all code
- **100% required** for:
  - Financial calculations
  - Authentication logic
  - Security-critical code
  - Core business logic
  - Event generation

## Best Practices

**DO:**
- ✅ Write test FIRST, before implementation
- ✅ Run tests and verify they FAIL before implementing
- ✅ Write minimal code to make tests pass
- ✅ Refactor only after tests are green
- ✅ Add edge cases and error scenarios
- ✅ Test behavior, not implementation
- ✅ Use descriptive test names

**DON'T:**
- ❌ Write implementation before tests
- ❌ Skip running tests after each change
- ❌ Write too much code at once
- ❌ Ignore failing tests
- ❌ Test implementation details
- ❌ Mock everything (prefer integration tests)

## TDD for LA-CAJA Features

### New Feature Workflow
1. Use `@qa` role or `/tdd` command
2. Define interfaces and DTOs
3. Write failing tests
4. Implement minimal code
5. Refactor and improve
6. Verify coverage

### Bug Fix Workflow
1. Write test that reproduces bug
2. Verify test fails
3. Fix bug
4. Verify test passes
5. Add regression tests
