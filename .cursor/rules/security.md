# Security Guidelines

## Mandatory Security Checks

Before ANY commit:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML)
- [ ] CSRF protection enabled
- [ ] Authentication/authorization verified
- [ ] Rate limiting on all endpoints
- [ ] Error messages don't leak sensitive data
- [ ] Multi-tenant isolation (store_id) verified
- [ ] Event sourcing security (no direct DB mutations)

## Secret Management

```typescript
// NEVER: Hardcoded secrets
const apiKey = "sk-proj-xxxxx"

// ALWAYS: Environment variables
const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

## Security Response Protocol

If security issue found:
1. STOP immediately
2. Use **@security** role or security-reviewer agent
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets
5. Review entire codebase for similar issues

## LA-CAJA Specific Security

- **Multi-tenant isolation**: Always filter by `store_id` in queries
- **Event sourcing**: Never mutate state directly, use events
- **Offline-first**: Validate data integrity on sync
- **TypeORM**: Use parameterized queries, never string concatenation
- **JWT tokens**: Validate expiration and signature
- **RLS policies**: Verify Row Level Security is enabled on sensitive tables
