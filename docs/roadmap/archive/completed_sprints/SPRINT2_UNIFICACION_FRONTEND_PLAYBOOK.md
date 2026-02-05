# Sprint 2 - Unificacion Frontend (Playbook colaborativo: Architect + Implementador)

**Proyecto:** Velox POS / LA-CAJA  
**Fecha:** 2026-02-03  
**Owner de arquitectura:** Architect Agent

## 1) Objetivo del sprint

Eliminar la duplicacion estructural entre `apps/pwa` y `apps/desktop` moviendo codigo compartido a paquetes reutilizables, sin romper produccion.

Resultado esperado:
- feature parity entre PWA y Desktop;
- menor costo de mantenimiento;
- base solida para Android shell.

## 2) Principios no negociables

1. No romper flujos criticos POS (venta, cobro, cierre, sync).
2. Migracion incremental por vertical slice (no big-bang).
3. Cada fase debe cerrar con build + test + lint:ratchet en verde.
4. Sin copia manual entre apps (deprecar `scripts/copy-pwa-to-desktop.ps1`).
5. Contratos tipados y API estable para consumo multi-shell.

## 3) Arquitectura target de frontend

Crear estos paquetes:
- `packages/ui-core`: componentes UI puros, tokens, primitives.
- `packages/app-core`: hooks, providers, use-cases cliente, routing helpers.
- `packages/api-client`: cliente HTTP tipado + manejo de auth/headers/errors.
- `packages/offline-core`: persistencia local, cola, sync helpers, conflictos.

Cada shell mantiene solo:
- entrypoint,
- configuracion de plataforma,
- bridges nativos (Tauri/web).

## 4) Plan por fases (robusto)

## Fase 0 - Baseline y guardrails (1-2 dias)

### Tareas
- Congelar baseline de calidad y performance:
  - `npm run lint:ratchet`
  - `npm run test`
  - `npm run build`
- Medir duplicacion actual PWA/Desktop (snapshot inicial).
- Definir ownership de carpetas migradas.

### Criterio de salida
- Baseline documentado y reproducible en CI.

### Resultados Fase 0 (2026-02-02)
- **Lint Ratchet:** OK (API: 3254 errors/baseline, PWA: 43 errors/baseline, Desktop: 35 errors/baseline).
- **Test Suite:** PASS (green).
- **Duplicacion Frontend:** ~85.29% exact match (348 archivos identicos de ~408).
  - PWA files: 408
  - Desktop files: 406
  - Exact copies: 348


## Fase 1 - Extraer `ui-core` (2-3 dias)

### Tareas
- Mover primero componentes estables y de bajo riesgo:
  - button, input, dialog, table base, form wrappers.
- Publicar exports limpios y tipados.
- Reemplazar imports en PWA/Desktop por `@la-caja/ui-core`.

### Criterio de salida
- 0 regresiones visuales en componentes migrados.
- builds de ambos shells en verde.

## Fase 2 - Extraer `api-client` + `offline-core` (3-4 dias)

### Tareas
- Unificar configuracion axios/fetch e interceptores.
- Estandarizar headers y auth token flow.
- Mover logica comun de cola/sync/conflictos a `offline-core`.
- Mantener adaptadores por plataforma cuando aplique.

### Criterio de salida
- un solo cliente HTTP compartido;
- tests de sync y auth sin cambios de comportamiento.

## Fase 3 - Extraer `app-core` (3-4 dias)

### Tareas
- Mover providers y hooks compartidos (auth, permisos, tienda, cache).
- Mover vertical slices de pantallas compartibles.
- Dejar wrappers especificos por shell solo donde sea necesario.

### Criterio de salida
- duplicacion exacta PWA/Desktop por debajo del 40%.
- tiempo de implementar cambio cross-platform mejora >= 30%.

## Fase 4 - Deprecacion de copia manual y hardening (1-2 dias)

### Tareas
- Marcar `scripts/copy-pwa-to-desktop.ps1` como deprecated.
- Actualizar docs de contribucion y flujo de desarrollo.
- Agregar smoke checks por shell y pruebas de regresion rapidas.

### Criterio de salida
- flujo oficial sin copia manual;
- CI bloquea regresiones de calidad.

## 5) Definicion de Done del sprint

- CI en verde (`build`, `test`, `lint:ratchet`) para API/PWA/Desktop.
- Duplicacion exacta PWA/Desktop < 40%.
- Script de copia manual deprecado y fuera del flujo principal.
- Documentacion actualizada de arquitectura frontend.
- Handoff tecnico para Sprint 3 (Commerce Core refactor).

## 6) Riesgos y mitigaciones

1. **Riesgo:** romper runtime en Desktop por diferencias de plataforma.  
   **Mitigacion:** adapter layer por shell + smoke tests en ambos canales.

2. **Riesgo:** migracion grande y desordenada.  
   **Mitigacion:** PRs pequenos por slice (UI -> API -> offline -> app-core).

3. **Riesgo:** drift de contratos durante extraccion.  
   **Mitigacion:** tipos compartidos + tests de contrato para endpoints criticos.

## 7) Checklist operacional para el otro agente

Antes de cada PR:
- ejecutar `npm run build`
- ejecutar `npm run test`
- ejecutar `npm run lint:ratchet`
- validar que no se incremento duplicacion
- adjuntar diff de imports migrados

Al cerrar cada fase:
- actualizar changelog tecnico del sprint
- registrar decision relevante en ADR si cambia arquitectura

## 8) Prompt sugerido para el agente implementador

"Implementa la Fase X del archivo `docs/roadmap/SPRINT2_UNIFICACION_FRONTEND_PLAYBOOK.md` con PR pequeno, sin romper CI. Prioriza migracion incremental, contratos tipados y paridad PWA/Desktop. Reporta: archivos tocados, riesgos, pruebas ejecutadas y resultado de KPIs de fase."

## 9) Modo colaborativo (para que lo hagan juntos)

### Rol A - Architect Agent
- define alcance exacto de la fase;
- fija contratos (tipos, interfaces, boundaries);
- valida riesgos de arquitectura antes de codificar;
- aprueba o rechaza el cierre de fase con evidencia.

### Rol B - Implementador Agent
- ejecuta cambios de codigo por slices pequenos;
- mantiene compatibilidad PWA/Desktop;
- corre pruebas y adjunta resultados;
- prepara PR con notas tecnicas y riesgos.

### Protocolo de handoff por fase
1. Architect publica mini-brief de fase (max 1 pagina).
2. Implementador ejecuta en PR pequeno y reporta evidencia.
3. Architect revisa contra DoD/KPIs y decide `ACEPTADO` o `RETRABAJO`.
4. Si es aceptado, ambos actualizan roadmap/changelog/ADR si aplica.

### Formato minimo de reporte conjunto
- Fase ejecutada.
- Archivos tocados.
- Riesgos detectados y mitigacion.
- Resultado de `npm run build`, `npm run test`, `npm run lint:ratchet`.
- KPI de duplicacion antes vs despues.

### Prompt sugerido para trabajo en pareja
"Trabajen en conjunto sobre la Fase X de `docs/roadmap/SPRINT2_UNIFICACION_FRONTEND_PLAYBOOK.md`: Architect define contratos y criterios; Implementador ejecuta cambios incrementales y evidencia tecnica. No cerrar fase sin veredicto explicito de Architect."
