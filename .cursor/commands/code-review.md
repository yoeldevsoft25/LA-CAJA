# Code Review Command

Comprehensive security and quality review of uncommitted changes.

## What This Command Does

1. Get changed files: `git diff --name-only HEAD`
2. Review each file for issues
3. Generate report with severity levels
4. Block commit if CRITICAL or HIGH issues found

## Review Checklist

### Security Issues (CRITICAL)
- [ ] Hardcoded credentials, API keys, tokens
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities
- [ ] Missing input validation
- [ ] Insecure dependencies
- [ ] Path traversal risks
- [ ] Missing store_id filtering (multi-tenant)
- [ ] Direct database mutations (should use events)

### Code Quality (HIGH)
- [ ] Functions > 50 lines
- [ ] Files > 800 lines
- [ ] Nesting depth > 4 levels
- [ ] Missing error handling
- [ ] console.log statements (use logger)
- [ ] TODO/FIXME comments
- [ ] Missing JSDoc for public APIs
- [ ] TypeScript `any` types
- [ ] Missing tests for new code

### Best Practices (MEDIUM)
- [ ] Mutation patterns (use immutable instead)
- [ ] Missing offline-first handling
- [ ] Missing event generation for state changes
- [ ] Missing store_id validation
- [ ] Accessibility issues (a11y)

## Report Format

```
Severity: CRITICAL | HIGH | MEDIUM | LOW
File: path/to/file.ts
Line: 42
Issue: Description
Fix: Suggested solution
```

## LA-CAJA Specific Checks

- **Multi-tenant**: Verify store_id filtering in all queries
- **Event Sourcing**: Verify events generated for state changes
- **Offline-first**: Verify offline scenarios handled
- **TypeORM**: Verify parameterized queries (no string concatenation)
- **NestJS**: Verify proper use of guards, interceptors, pipes

## Never Approve

- Security vulnerabilities
- Missing store_id filtering
- Direct database mutations (bypass events)
- Hardcoded secrets
- SQL injection risks

## Related

- Rule: `.cursor/rules/security.md`
- Rule: `.cursor/rules/coding-style.md`
- Role: `@security`
