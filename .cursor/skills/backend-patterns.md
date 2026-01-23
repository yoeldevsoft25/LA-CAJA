# Backend Patterns - LA-CAJA

## NestJS Architecture

### Module Structure
- Feature-based modules (products, sales, inventory, etc.)
- Each module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/`
- Use `TypeOrmModule.forFeature([...entities])` for database access
- Export services that other modules need

### Controllers
```typescript
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  @Get()
  @Roles('owner', 'cashier')
  async findAll(@Query() query: GetProductsDto) {
    // Always filter by store_id from authenticated user
  }
}
```

### Services
- Business logic in services, not controllers
- Always inject `@InjectRepository(Entity)` for database access
- Use DTOs for validation with `class-validator`
- Handle errors gracefully with try-catch

### DTOs
- Use `class-validator` decorators
- Separate Create/Update DTOs
- Response DTOs for API responses
- Always validate `store_id` matches authenticated user

## Event Sourcing Pattern

### Event Generation
```typescript
// Always generate events for state changes
const event = {
  event_id: uuidv4(),
  store_id: user.store_id,
  device_id: deviceId,
  seq: nextSeq,
  type: 'SaleCreated',
  version: 1,
  created_at: new Date(),
  actor_user_id: user.id,
  actor_role: user.role,
  payload: { sale_id, items, total }
}
```

### Event Store
- Events table: `events` with deduplication by `(store_id, device_id, seq)`
- Never mutate state directly, always through events
- Use projections for read models

## Multi-Tenant Isolation

### Always Filter by store_id
```typescript
// CORRECT
const products = await this.productsRepository.find({
  where: { store_id: user.store_id }
})

// WRONG - Missing store_id filter
const products = await this.productsRepository.find()
```

### Interceptors
- `StoreIdValidationInterceptor` - Validates store_id in requests
- Always use authenticated user's store_id, never trust client

## Database Patterns

### TypeORM
- Use migrations (never `synchronize: true`)
- Use parameterized queries (never string concatenation)
- Use indexes on foreign keys and frequently queried columns
- Use materialized views for complex aggregations

### Migrations
- Located in `apps/api/src/database/migrations/`
- Numbered sequentially: `001_initial_schema.sql`, `002_...`
- Always test on dev database first
- Include rollback if needed

## Offline-First Sync

### CRDT Service
- Use CRDT for conflict resolution
- Last-write-wins with vector clocks
- Sync service handles bidirectional sync

### Sync Patterns
- Batch events for efficiency
- Incremental sync (only changed data)
- Handle conflicts gracefully
- Queue sync operations when offline

## Security Patterns

### Authentication
- JWT tokens with expiration
- Validate tokens on every request
- Use `JwtAuthGuard` on protected routes

### Authorization
- Role-based: `owner`, `cashier`
- Use `RolesGuard` with `@Roles()` decorator
- Check permissions in services

### Input Validation
- Use `ValidationPipe` globally
- `whitelist: true` - remove unknown properties
- `forbidNonWhitelisted: true` - reject unknown properties
- Validate all DTOs with `class-validator`

## Error Handling

```typescript
try {
  const result = await operation()
  return result
} catch (error) {
  if (error instanceof EntityNotFoundError) {
    throw new NotFoundException('Resource not found')
  }
  throw new InternalServerErrorException('Operation failed')
}
```

## Rate Limiting

- Global rate limiting with `ThrottlerModule`
- Configurable via environment variables
- Applied via `ThrottlerGuard`

## Best Practices

1. **Immutability**: Never mutate entities directly, create new objects
2. **Small files**: 200-400 lines typical, 800 max
3. **Single responsibility**: One service per domain
4. **Dependency injection**: Use NestJS DI, avoid singletons
5. **Type safety**: TypeScript strict mode, no `any`
6. **Documentation**: JSDoc for public APIs
7. **Testing**: Unit tests for services, integration tests for endpoints
