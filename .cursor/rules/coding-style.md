# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate:

```typescript
// WRONG: Mutation
function updateUser(user, name) {
  user.name = name  // MUTATION!
  return user
}

// CORRECT: Immutability
function updateUser(user, name) {
  return {
    ...user,
    name
  }
}
```

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large components
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('Detailed user-friendly message')
}
```

## Input Validation

ALWAYS validate user input using class-validator:

```typescript
import { IsString, IsEmail, IsNumber, Min, Max } from 'class-validator'

export class CreateUserDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsNumber()
  @Min(0)
  @Max(150)
  age: number
}
```

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No console.log statements (use logger)
- [ ] No hardcoded values
- [ ] No mutation (immutable patterns used)
- [ ] TypeScript strict mode (no `any`)
- [ ] JSDoc for public APIs

## LA-CAJA Specific Conventions

- **Naming**: camelCase (variables), PascalCase (clases), UPPER_CASE (constantes)
- **Files**: kebab-case.ts
- **Events**: PascalCaseEvent (ej: SaleCreatedEvent)
- **DTOs**: CreateXDto, UpdateXDto, XResponseDto
- **Offline-first**: Always handle offline scenarios gracefully
- **Event Sourcing**: Generate events for all state changes
