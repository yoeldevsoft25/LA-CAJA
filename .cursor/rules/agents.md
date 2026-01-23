# Agent Orchestration

## Available Roles

Located in `.cursor/commands/` and `.cursor/prompts/`:

| Role | Purpose | When to Use |
|------|---------|-------------|
| @architect | System design | Architectural decisions |
| @backend | Backend development | API, database, services |
| @frontend | Frontend development | React, UI, PWA |
| @qa | Test-driven development | New features, bug fixes |
| @security | Security analysis | Before commits, security reviews |
| @devops | Infrastructure | CI/CD, deployments |
| @data | Data analysis | Analytics, reports |
| @ml | Machine learning | ML features |

## Immediate Role Usage

No user prompt needed:
1. Complex feature requests - Use **@architect** role
2. Code just written/modified - Use **@security** role
3. Bug fix or new feature - Use **@qa** role
4. Architectural decision - Use **@architect** role
5. Backend work - Use **@backend** role
6. Frontend work - Use **@frontend** role

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 roles in parallel:
1. @security: Security analysis of auth.ts
2. @backend: Performance review of cache system
3. @qa: Type checking of utils.ts

# BAD: Sequential when unnecessary
First @security, then @backend, then @qa
```

## Multi-Perspective Analysis

For complex problems, use multiple roles:
- @security: Security expert
- @backend: Senior engineer
- @architect: Consistency reviewer
- @qa: Test coverage checker
