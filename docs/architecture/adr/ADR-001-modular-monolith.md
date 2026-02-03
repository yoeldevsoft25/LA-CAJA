# ADR-001: Mantener Modular Monolith como core 2026

## Estado
Aceptada (2026H1)

## Contexto
Velox POS Linea A requiere escalar, pero la complejidad operacional de microservicios prematuros es un riesgo alto.
Actualmente existe una base de codigo (monorepo) que ya sigue principios modulares pero tiene acoplamiento.

## Decision
Mantener una **Arquitectura de Monolito Modular** como el core transaccional del sistema.
Esto implica rechazar la migracion a microservicios independientes por ahora.

## Consecuencias
### Positivas
- Velocidad de desarrollo alta (refactoring mas facil).
- Menor complejidad operacional (menos servicios que orquestar).
- Mejor coherencia transaccional (ACID).

### Negativas
- Requiere gobernanza estricta para evitar "Big Ball of Mud".
- Despliegue monolitico (aunque modular).

## Alternativas Consideradas
- Microservicios inmediatos: Rechazado por complejidad operacional y overhead.
