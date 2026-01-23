# Plan Command

Create comprehensive implementation plan for features or refactoring.

## What This Command Does

1. Analyze requirements
2. Identify dependencies
3. Break down into phases
4. Identify risks
5. Create implementation plan

## When to Use

- Complex feature requests
- Large refactoring tasks
- Architectural decisions
- Multi-step implementations

## Plan Structure

1. **Analysis**
   - Understand requirements
   - Identify existing code
   - Identify dependencies

2. **Design**
   - Propose architecture
   - Define interfaces
   - Define data models

3. **Implementation Phases**
   - Phase 1: Core functionality
   - Phase 2: Integration
   - Phase 3: Testing
   - Phase 4: Documentation

4. **Risks**
   - Technical risks
   - Timeline risks
   - Dependencies

## LA-CAJA Considerations

- **Event Sourcing**: Plan event schema changes
- **Multi-tenant**: Ensure store_id isolation
- **Offline-first**: Plan sync scenarios
- **Migrations**: Plan database changes
- **Testing**: Plan test coverage

## Related

- Role: `@architect`
- Skill: `.cursor/skills/backend-patterns.md`
- Skill: `.cursor/skills/frontend-patterns.md`
