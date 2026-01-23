# Cursor Configuration - LA-CAJA

Configuración profesional de Cursor basada en [everything-claude-code](https://github.com/affaan-m/everything-claude-code).

## Estructura Completa

```
.cursor/
├── rules/          # Reglas siempre activas
│   ├── security.md
│   ├── coding-style.md
│   ├── testing.md
│   ├── git-workflow.md
│   ├── performance.md
│   └── agents.md
├── skills/         # Patrones y workflows
│   ├── backend-patterns.md
│   ├── frontend-patterns.md
│   ├── tdd-workflow.md
│   ├── security-review/
│   └── coding-standards/
├── commands/       # Comandos rápidos
│   ├── tdd.md
│   ├── code-review.md
│   ├── plan.md
│   ├── e2e.md
│   ├── build-fix.md
│   ├── refactor-clean.md
│   └── test-coverage.md
├── agents/         # Agentes especializados
│   ├── planner.md
│   ├── architect.md
│   ├── tdd-guide.md
│   ├── code-reviewer.md
│   ├── security-reviewer.md
│   ├── build-error-resolver.md
│   ├── e2e-runner.md
│   ├── refactor-cleaner.md
│   └── doc-updater.md
├── contexts/       # Contextos dinámicos
│   ├── dev.md
│   ├── review.md
│   └── research.md
├── prompts/        # Prompts de roles (existente)
└── README.md       # Este archivo
```

## Rules (Reglas)

Reglas que siempre se aplican. Ubicadas en `.cursor/rules/`:

- **security.md** - Checklist de seguridad, manejo de secretos
- **coding-style.md** - Inmutabilidad, organización de archivos, calidad
- **testing.md** - TDD, cobertura mínima 80%
- **git-workflow.md** - Formato de commits, flujo de PRs
- **performance.md** - Optimización, gestión de contexto
- **agents.md** - Cuándo usar cada rol/agente

## Skills (Habilidades)

Patrones y workflows específicos. Ubicados en `.cursor/skills/`:

- **backend-patterns.md** - Patrones NestJS, Event Sourcing, Multi-tenant
- **frontend-patterns.md** - Patrones React, Offline-first, PWA
- **tdd-workflow.md** - Workflow completo de TDD
- **security-review/** - Checklist de seguridad
- **coding-standards/** - Estándares de código

## Commands (Comandos)

Comandos rápidos para tareas comunes. Ubicados en `.cursor/commands/`:

- **tdd.md** - Desarrollo guiado por tests
- **code-review.md** - Revisión de código y seguridad
- **plan.md** - Planificación de implementación
- **e2e.md** - Tests end-to-end con Playwright
- **build-fix.md** - Resolver errores de build
- **refactor-clean.md** - Limpieza de código muerto
- **test-coverage.md** - Análisis de cobertura de tests

## Agents (Agentes)

Agentes especializados para tareas específicas. Ubicados en `.cursor/agents/`:

- **planner.md** - Planificación de features complejas
- **architect.md** - Decisiones arquitectónicas
- **tdd-guide.md** - Guía de TDD
- **code-reviewer.md** - Revisión de calidad
- **security-reviewer.md** - Análisis de vulnerabilidades
- **build-error-resolver.md** - Resolver errores de build
- **e2e-runner.md** - Tests E2E con Playwright
- **refactor-cleaner.md** - Limpieza de código muerto
- **doc-updater.md** - Actualización de documentación

## Contexts (Contextos)

Contextos dinámicos para diferentes modos de trabajo. Ubicados en `.cursor/contexts/`:

- **dev.md** - Modo desarrollo activo
- **review.md** - Modo revisión de código
- **research.md** - Modo investigación

## Uso

### Roles
Menciona un rol para activar su contexto:
- `@backend` - Desarrollo backend
- `@frontend` - Desarrollo frontend
- `@security` - Revisión de seguridad
- `@qa` - Testing y TDD
- `@architect` - Diseño arquitectónico

### Agents
Los agents se pueden invocar directamente o referenciar en conversaciones:
- "Usa el planner agent para..."
- "Revisa con code-reviewer agent..."
- "Ejecuta security-reviewer agent..."

### Commands
Los commands se pueden invocar directamente o referenciar en conversaciones.

### Rules
Las rules se aplican automáticamente. Cursor las lee de `.cursor/rules/`.

### Contexts
Los contexts se pueden activar mencionando el modo:
- "Modo desarrollo" → activa dev.md
- "Modo revisión" → activa review.md
- "Modo investigación" → activa research.md

## Adaptado para LA-CAJA

Todas las configuraciones están adaptadas específicamente para:
- Event Sourcing + CQRS
- Multi-tenant (store_id isolation)
- Offline-first architecture
- NestJS + React stack
- TypeScript strict mode

## Fuente

Basado en: https://github.com/affaan-m/everything-claude-code

## Guía Completa

Para entender mejor cómo usar estos componentes, lee la guía completa:
- [The Shorthand Guide to Everything Claude Code](https://x.com/affaanmustafa/status/...)
- [The Longform Guide to Everything Claude Code](https://x.com/affaanmustafa/status/...)
