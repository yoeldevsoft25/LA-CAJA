# ADR-002: Frontend unificado por paquetes compartidos

## Estado
Aceptada

## Contexto
Actualmente existe una duplicacion extrema entre `apps/pwa` y `apps/desktop` (~86% codigo identico), mantenido por scripts de copia manual (`copy-pwa-to-desktop.ps1`). Esto es insostenible y propenso a errores.

## Decision
Implementar una arquitectura de **paquetes compartidos** (`packages/ui-core`, `packages/app-core`) que contengan la logica y componentes UI.
Las aplicaciones `pwa` y `desktop` seran "shells" ligeros que consumen estos paquetes.
El script de copia manual queda deprecado.

## Consecuencias
### Positivas
- Elimina duplicacion de codigo (Single Source of Truth).
- Reduce bugs de regresion por diferencias entre plataformas.
- Acelera release de features cross-platform.

### Negativas
- Migracion inicial demandante (refactor grande).
- Curva de aprendizaje para gestion de paquetes internos.

## Alternativas Consideradas
- Mantener script de copia: Rechazado por riesgo de drift y DX pobre.
