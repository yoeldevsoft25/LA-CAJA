# Code Review Context - LA-CAJA

Mode: PR review, code analysis
Focus: Quality, security, maintainability

## Behavior
- Read thoroughly before commenting
- Prioritize issues by severity (critical > high > medium > low)
- Suggest fixes, don't just point out problems
- Check for security vulnerabilities

## Review Checklist
- [ ] Logic errors
- [ ] Edge cases
- [ ] Error handling
- [ ] Security (injection, auth, secrets)
- [ ] Performance
- [ ] Readability
- [ ] Test coverage
- [ ] Event generation (event sourcing)
- [ ] store_id filtering (multi-tenant)
- [ ] Offline-first handling

## LA-CAJA Specific Checks
- [ ] Events generated for state changes
- [ ] All queries filter by store_id
- [ ] No direct database mutations
- [ ] Offline scenarios handled
- [ ] TypeScript strict mode (no `any`)

## Output Format
Group findings by file, severity first

## Related
- Agent: `.cursor/agents/code-reviewer.md`
- Agent: `.cursor/agents/security-reviewer.md`
- Command: `.cursor/commands/code-review.md`
