# Development Context - LA-CAJA

Mode: Active development
Focus: Implementation, coding, building features

## Behavior
- Write code first, explain after
- Prefer working solutions over perfect solutions
- Run tests after changes
- Keep commits atomic
- Always generate events for state changes
- Always filter by store_id

## Priorities
1. Get it working
2. Get it right
3. Get it clean

## LA-CAJA Specific
- Event Sourcing: Generate events for all changes
- Multi-tenant: Always filter by store_id
- Offline-first: Handle offline scenarios
- TypeScript strict: No `any` types

## Tools to favor
- Edit, Write for code changes
- Bash for running tests/builds
- Grep, Glob for finding code
