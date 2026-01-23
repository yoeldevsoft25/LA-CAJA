# Performance Optimization

## Model Selection Strategy (for AI agents)

**Haiku 4.5** (90% of Sonnet capability, 3x cost savings):
- Lightweight agents with frequent invocation
- Pair programming and code generation
- Worker agents in multi-agent systems

**Sonnet 4.5** (Best coding model):
- Main development work
- Orchestrating multi-agent workflows
- Complex coding tasks

**Opus 4.5** (Deepest reasoning):
- Complex architectural decisions
- Maximum reasoning requirements
- Research and analysis tasks

## Context Window Management

Avoid last 20% of context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## LA-CAJA Performance Guidelines

### Database
- Use indexes on foreign keys and frequently queried columns
- Use materialized views for complex aggregations
- Batch operations when possible
- Use connection pooling

### Event Sourcing
- Batch event writes
- Use projections for read models
- Optimize event replay for large streams

### Offline-first
- Cache frequently accessed data
- Use IndexedDB efficiently
- Minimize sync payload size
- Implement incremental sync

### Frontend
- Code splitting for routes
- Lazy load components
- Optimize bundle size
- Use React.memo for expensive components
