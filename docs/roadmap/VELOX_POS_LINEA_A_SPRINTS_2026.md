# VELOX POS Linea A 2026
## Arquitectura objetivo + Plan Maestro de Sprints para dominar el mercado

**Fecha:** 2026-02-03  
**Rol aplicado:** `.cursor/agents/architect.md`  
**Estado:** Propuesta ejecutable basada en analisis del repositorio + benchmarking externo

---

## Estado de ejecucion real (actualizado)

> Corte de estado: **2026-02-03** (ultimo bloque de trabajo validado en rama `main`).

### Resumen ejecutivo de avance

- **Sprint 1 (Estabilizacion):** **🟡 Muy avanzado**
  - Build API/PWA/Desktop validado en los ultimos ciclos.
  - Quedan deudas menores de entorno local y estandarizacion final de CI en la cuenta principal.
- **Sprint 2 (Unificacion Frontend):** **✅ Avance mayor completado**
  - Base compartida consolidada (`ui-core`, `api-client`, `offline-core`, `app-core`).
  - Reduccion fuerte de duplicacion estructural entre PWA/Desktop.
- **Sprint 3 (Commerce Core I):** **✅ Avance mayor completado**
  - Refactor CQRS en `sales` (queries/commands/handlers).
  - Descomposicion de dominio de devoluciones (validation/inventory/financial/domain services).
  - Cobertura de contratos + integration tests transaccionales para devoluciones.
- **Sprint 4 (Finance/Fiscal + Auth):** **✅ Completado**
  - **Sprint 4.1 ✅ cerrado:** hardening auth/refresh/session + tests dedicados.
  - **Sprint 4.2 ✅ cerrado:** extraccion de `AccountingPeriodService` + pruebas de periodo.
  - **Sprint 4.3 ✅ cerrado:** extraccion de `AccountingSharedService` y eliminacion de ciclo circular entre servicios.
  - **Sprint 4.4 ✅ cerrado:** extraccion de `AccountingReportingService`, ajuste robusto de DI en `AccountingPeriodService`, pruebas del bloque reporting.
- **Sprint 5 (Data Platform & Migraciones):** **🟡 En ejecucion (5.1-5.2 completados)**
  - Gobernanza de migraciones con validaciones automaticas y ADR aceptado.
  - Rehearsal/upgrade/backfill endurecidos con politica PROD-SAFE (allowlist local).
  - Base de particionado `events` preparada con migraciones `V/D`.
- **Sprint 7 (Performance comercial):** **🟡 Parcial**
  - Refactor UX/UI del checkout modal (PWA + Desktop) ya integrado.
  - Sigue pendiente plan formal de chunking y reduccion de bundle grande.
- **Sprints 6/8/9/10:** **⏳ Pendientes**

### Evidencia tecnica reciente (commits en `main`)

- `0e00a16` feat(sales): integrate returns domain decomposition with any-zero type hardening
- `8fdcc30` fix(pwa): resolve frontend compile issues for sales and sync paths
- `97c7c91` fix(pwa): add workspace path aliases in vite config
- `f2712b0` feat(checkout): redesign modal shell and internal UX for pwa and desktop
- `1ea9512` test(sales): add transactional integration coverage for returns flows
- `ff00510` feat(auth): harden refresh/session flow with strict typing and tests
- `068a646` refactor(accounting): extract period service and add focused tests
- `0318ad2` refactor(accounting): extract shared helpers to remove service cycle
- `a6a70f0` refactor(accounting): extract reporting service and fix period DI wiring
- `6d5d192` docs(roadmap): close sprint 4 and update execution status

### Trazabilidad de robustez offline-first (2026-02-05)

- **Objetivo:** evitar bloqueos de operacion cuando hay caida de endpoints o desconexion de internet, sin perder ventas ni cerrar sesion.
- **Deteccion diferenciada implementada:**
  - `sin internet` via `navigator.onLine=false`.
  - `internet disponible + endpoints no disponibles` via eventos globales (`api:all_endpoints_down`, `api:endpoint_recovered`) y bandera `localStorage: velox_server_unavailable`.
- **Cambios tecnicos aplicados (E2E):**
  - Lock distribuido de push entre foreground/SW para eliminar carrera y doble envio (`apps/pwa/src/services/sync.service.ts`, `apps/pwa/src/sw.ts`).
  - Filtrado de eventos realmente pendientes en IndexedDB antes de `/sync/push` (fuente de verdad local).
  - WebSockets (`realtime` y `notifications`) con control de reconexion offline, anti-duplicado de socket y backoff con jitter.
  - Failover probes deshabilitados cuando no hay internet para evitar ruido/storm.
  - Señalizacion de backend no disponible desde capa API client y limpieza automatica al recuperar endpoint.
  - Banner de UX actualizado: **\"Servidor en mantenimiento, tus ventas se guardan localmente\"**.
  - Sesion protegida en modo offline/mantenimiento: no se fuerza logout por inactividad ni por validacion de licencia mientras backend no este disponible.
  - Diagnostico de federacion agregado en API: `GET /sync/federation/status` (estado de cola `federation-sync`, endpoint remoto configurado, probe remoto, ultimo error de relay).
  - Bridge de federacion para ventas online directas: `/sales` ahora genera evento `SaleCreated` y encola `federation-sync` (evita que ventas creadas fuera de `/sync/push` se queden solo en una base).
  - Ajuste de seguridad en `/sync/push` para federacion: `system-federation` no falla por mismatch entre `actor.user_id` y `authenticatedUserId`.
  - Hardening CORS para Desktop/Tauri en Render: `http://tauri.localhost` permitido y bloqueo CORS sin excepción (sin 500 en preflight/health).
- **Validacion tecnica:** build `packages/api-client` y build `apps/pwa` en PASS despues del hardening.

### KPI operativo (ultimo estado validado)

- `sales-contract.spec.ts`: **12/12** passing.
- `sales-returns.integration.spec.ts`: **3/3** passing.
- `auth.service.spec.ts`: **7/7** passing.
- `accounting-period.service.spec.ts`: **7/7** passing.
- `accounting-reporting.service.spec.ts`: **5/5** passing.
- `build` API/PWA/Desktop: **passing** en los ultimos ciclos.
- `lint:ratchet`: **passing** (API por debajo del baseline configurado).

### Estado de Sprint 4 (tracking secuencial)

- **Sprint 4.1 (Auth hardening):** **✅ Cerrado**
  - Refresh/session hardening implementado.
  - Tipado estricto en controller/service.
  - Evidencia: commit `ff00510`.
- **Sprint 4.2 (Accounting period extraction):** **✅ Cerrado**
  - Nuevo `AccountingPeriodService` con pruebas.
  - Delegacion desde `AccountingService`.
  - Evidencia: commit `068a646`.
- **Sprint 4.3 (circular dependency removal):** **✅ Cerrado**
  - Nuevo `AccountingSharedService`.
  - Eliminado ciclo entre `AccountingService` y `AccountingPeriodService`.
  - Evidencia: commit `0318ad2`.
- **Sprint 4.4 (financial reporting extraction):** **✅ Cerrado**
  - Nuevo `AccountingReportingService` y delegacion desde `AccountingService`.
  - Fix robusto de inyeccion en `AccountingPeriodService` para evitar fallo runtime de Nest.
  - Evidencia: commit `a6a70f0`.

### Estado de Sprint 5 (tracking secuencial)

- **Sprint 5.1 (migration governance):** **✅ Cerrado**
  - Convencion V/D + timestamp, ADR-005 aceptado, guia operativa.
  - Validador automatizado y pruebas de gobernanza.
- **Sprint 5.2 (rehearsal + partitioning foundation):** **✅ Cerrado**
  - Scripts `migration-rehearsal`, `migration-upgrade-rehearsal` y `partitioning-backfill` con guardas PROD-SAFE.
  - Bloqueo estricto de host remoto y ejecucion destructiva fuera de entorno local permitido.
  - Migraciones `V20260203105300__prepare_partitioning_events_schema.sql` y `D20260203105400__seed_partitioning_metadata.sql`.
  - Evidencia tecnica: `validate:migrations`, build API, lint-ratchet y test del validador en PASS.

---

## 0) Vision: la propuesta que hace temblar la competencia

**Velox POS Linea A** = un POS **offline-first real**, **auditado por eventos**, **multi-canal (PWA + Desktop + Android)** y con **inteligencia operativa** (prediccion + automatizacion) que entrega:

- continuidad operativa incluso con conectividad inestable;
- cierres de caja y trazabilidad confiables para auditoria;
- velocidad de operacion de mostrador (menos friccion, mas ventas/hora);
- una plataforma escalable para crecer de decenas a miles de tiendas.

Objetivo estrategico: que Velox no compita por "tener funciones", sino por **confiabilidad, velocidad y capacidad de evolucion**.

---

## 1) Analisis profundo del estado actual (auditado en repo)

## 1.1 Fortalezas reales

1. **Base tecnologica potente:** monorepo con `apps/api` (NestJS + Fastify), `apps/pwa` (React + Vite + Dexie + PWA), `apps/desktop` (Tauri + React), paquetes de dominio/sync.
2. **Capacidad funcional amplia en backend:** 52 controladores, 52 modulos, ~404 rutas decoradas, 100+ entidades.
3. **Offline-first ya iniciado:** cola de sincronizacion, vector clocks, conflictos, cache local e IndexedDB.
4. **Base de seguridad inicial presente:** JWT, validacion de secrets, `helmet`, throttling, interceptores de validacion por `store_id`.
5. **Capacidad de build parcial saludable:** API y PWA construyen en produccion.

## 1.2 Hallazgos criticos (bloqueadores para Linea A)

1. **Duplicacion estructural PWA/Desktop extremadamente alta**
   - 405 rutas de archivo equivalentes entre ambos frontends.
   - 347 archivos identicos (86% de duplicacion exacta).
   - Existe script de copia manual `scripts/copy-pwa-to-desktop.ps1`.

2. **Servicios y componentes sobredimensionados**
   - Backend: `accounting.service.ts` (~4237 lineas), `sales.service.ts` (~2665), `ml.service.ts` (~1837), `auth.service.ts` (~1762).
   - Frontend: multiples pantallas/componentes >1000 lineas.

3. **Calidad de ingenieria inconsistente**
   - `npm run build --workspace=apps/desktop` falla por tipado en `apps/desktop/src/lib/api.ts:270`.
   - `npm run test --workspace=apps/pwa -- --run` falla (dependencia faltante `@testing-library/dom`).
   - `npm run lint --workspace=apps/pwa` falla (50 errores, 20 warnings).
   - `apps/desktop` no tiene script `test`.

4. **Desalineacion arquitectonica**
   - Se declara Event Sourcing/CQRS global, pero en la practica hay combinacion de rutas CRUD directas + rutas por eventos.
   - `packages/application` (capa de casos de uso) esta practicamente vacio.

5. **Deuda de datos y migraciones**
   - 115 archivos SQL de migracion; 14 numeraciones duplicadas (colisiones de versionado).
   - Mezcla de migraciones estructurales + scripts de correccion puntual en el mismo flujo.

6. **Riesgo de seguridad/dependencias**
   - `npm audit --json`: 23 vulnerabilidades (5 high, 13 moderate, 5 low).

7. **Performance frontend mejorable para escala**
   - Chunk `react-vendor` en PWA ~1.54 MB (minificado), con warnings de chunking/dynamic import.

## 1.3 Baseline tecnico cuantificado (hoy)

- `apps/api/src`: **462 archivos TS**, ~**72,107 LOC**.
- `apps/pwa/src`: **405 archivos TS/TSX**, ~**98,585 LOC**.
- `apps/desktop/src`: **403 archivos TS/TSX**, ~**97,638 LOC**.
- Uso de `any` en codigo (api+pwa+desktop+packages): **1458**.
- `console.*` en codigo: **304**.
- Tests API: **13 suites** (12 pass / 1 fail actualmente).

---

## 2) Benchmark externo: arquitecturas recomendadas y decision para Velox

## 2.1 Arquitecturas evaluadas

| Estilo | Donde brilla | Riesgo principal | Decision para Velox |
|---|---|---|---|
| Modular Monolith | Equipos small/medium, alta velocidad de producto, limites claros por dominio | Derivar a "big ball of mud" si no se gobiernan limites | **SI, arquitectura base ahora** |
| Microservices | Escala organizacional alta, despliegues independientes por dominio | Complejidad operacional prematura | **NO ahora; SI como evolucion selectiva** |
| Event-Driven + CQRS + Event Sourcing | Auditoria, trazabilidad, asincronia, integraciones | Mayor complejidad de consistencia y modelado | **SI, en dominios criticos (ventas/pagos/inventario/sync)** |
| Serverless puntual | Tareas elasticas/event-driven, jobs no core | Acoplamiento a proveedor/costo variable | **SI, solo para jobs satelite (reportes, analitica)** |

## 2.2 Decision arquitectonica principal

Adoptar una **Arquitectura Hibrida de Linea A**:

1. **Core transaccional en Modular Monolith** (backend actual, pero refactorizado por bounded contexts).
2. **Event backbone fuerte** para dominios auditables y offline-first.
3. **Frontend unificado en paquetes compartidos** + shells especificos (PWA / Desktop / Android).
4. **Observabilidad y SRE by design** (SLOs + error budgets + trazas end-to-end).
5. **Seguridad operativa continua** (ASVS + hardening + supply-chain hygiene).

---

## 3) Arquitectura objetivo Linea A (Target State)

## 3.1 Mapa de alto nivel

```text
Canales
  PWA Shell      Desktop Shell (Tauri)      Android Shell
       \              |                    /
        \             |                   /
             Shared Front Platform
      (UI kit + app-core + api-client + offline-core)
                         |
                    API Gateway Layer
                         |
             Velox Backend Modular Core
  Sales | Inventory | Accounting | CRM | Fiscal | Licensing | Notifications
                         |
               Event Backbone + Job Queues
                         |
              PostgreSQL (RLS + particiones)
          + Redis (colas/cache) + Object Storage
                         |
         Observability Plane (metrics, traces, logs)
```

## 3.2 Principios de arquitectura Linea A

1. **Modularidad dura:** limites de dominio y contratos internos explicitos.
2. **Offline-first sin excepciones en flujos POS criticos.**
3. **Eventual consistency controlada:** comandos y proyecciones con idempotencia.
4. **Seguridad por defecto:** menor privilegio, trazabilidad y verificabilidad.
5. **Operabilidad como feature:** todo dominio nace con metricas y alertas.
6. **Arquitectura con ADRs:** cada decision importante queda registrada.

## 3.3 Bounded contexts propuestos (backend)

- **Commerce Core:** Sales, Payments, Discounts, Cash/Shift.
- **Catalog & Inventory:** Products, Variants, Lots, Warehouses, Transfers.
- **Finance & Fiscal:** Accounting, Fiscal Invoices, Exchange.
- **Customer Ops:** Customers, Debts, Reservations, Orders/Tables.
- **Platform & Growth:** Auth, Licenses, Notifications, Observability, ML.

---

## 4) ADRs estrategicos iniciales (con trade-offs)

## ADR-001: Mantener Modular Monolith como core 2026
- **Pros:** velocidad, menor complejidad operativa, mejor coherencia transaccional.
- **Cons:** requiere gobernanza estricta para evitar acoplamiento.
- **Alternativas:** microservices inmediatos.
- **Decision:** **aceptada** para 2026H1.

## ADR-002: Frontend unificado por paquetes compartidos
- **Pros:** elimina duplicacion, reduce bugs por drift, acelera releases.
- **Cons:** migracion inicial demandante.
- **Alternativas:** mantener copia PWA->Desktop.
- **Decision:** **aceptada** (el script de copia pasa a deprecado).

## ADR-003: Event Sourcing selectivo (no dogmatico)
- **Pros:** auditabilidad y reconciliacion robusta donde importa.
- **Cons:** complejidad en modelado y replay.
- **Alternativas:** CRUD puro en todos los dominios.
- **Decision:** **aceptada** para ventas/pagos/inventario/sync.

## ADR-004: Data governance estricto de migraciones
- **Pros:** despliegues repetibles, menos deuda de esquema.
- **Cons:** disciplina de equipo obligatoria.
- **Alternativas:** seguir con scripts ad-hoc.
- **Decision:** **aceptada**.

## ADR-005: SRE + observabilidad estandar (OpenTelemetry)
- **Pros:** MTTR menor, decisiones por datos, trazabilidad real.
- **Cons:** costo inicial de instrumentacion.
- **Alternativas:** logs dispersos sin estandar.
- **Decision:** **aceptada**.

## ADR-006: Seguridad continua (ASVS L2 + dependencias)
- **Pros:** menor superficie de riesgo, confianza enterprise.
- **Cons:** trabajo continuo, no puntual.
- **Alternativas:** auditorias esporadicas.
- **Decision:** **aceptada**.

---

## 5) Plan Maestro de Sprints (10 sprints / 20 semanas)

> Cadencia sugerida: **2 semanas por sprint**.  
> Cada sprint cierra con demo, metricas, retro y decision de continuidad.

## Sprint 1 - Estabilizacion de plataforma
**Objetivo:** pasar de "funciona parcialmente" a "base confiable".

**Entregables:**
- Build de Desktop en verde.
- Suite minima de tests en Desktop.
- PWA tests operativos (`@testing-library/dom` y setup estable).
- Pipeline CI unico (build+test+lint) para API/PWA/Desktop.

**DoD/KPIs:**
- 100% builds verdes en CI para los 3 canales.
- 0 bloqueos tipo "missing script/dependency".

## Sprint 2 - Unificacion Frontend (anti-duplicacion)
**Objetivo:** eliminar el cuello de botella PWA/Desktop.

**Entregables:**
- `packages/ui-core` y `packages/app-core` creados.
- Mover componentes/paginas/servicios compartibles a paquetes.
- Reemplazar `copy-pwa-to-desktop.ps1` por workspace shared imports.

**DoD/KPIs:**
- Duplicacion exacta PWA/Desktop < 40%.
- Tiempo de entrega de feature cross-platform reducido >= 30%.

## Sprint 3 - Refactor dominio Commerce Core I
**Objetivo:** partir `SalesService` en vertical slices mantenibles.

**Entregables:**
- Separacion en command/query services.
- Casos de uso en `packages/application` para ventas.
- Tests de contrato para endpoints criticos POS.

**DoD/KPIs:**
- Ningun archivo del dominio ventas > 1500 lineas.
- Cobertura de tests en dominio ventas >= 70% (unit+integration).

## Sprint 4 - Refactor dominio Finance/Fiscal y Auth
**Objetivo:** bajar riesgo operacional por servicios gigantes.

**Entregables:**
- Division de `accounting.service.ts` por subdominios.
- Hardening de auth/session/refresh con pruebas de seguridad.
- Reducir dependencias circulares (`forwardRef`) al minimo.

**DoD/KPIs:**
- Ningun servicio > 2000 lineas.
- Incidencias de auth por regresion = 0 en QA.

## Sprint 5 - Data Platform & Migraciones Linea A
**Objetivo:** gobernanza de datos enterprise-grade.

**Entregables:**
- Convencion unica de versionado de migraciones.
- Separacion formal: migracion estructural vs data-fix operacional.
- Test automatizado de migracion en entorno limpio + entorno con datos.
- Plan de particion para tabla `events` y politicas de archivado.

**DoD/KPIs:**
- 0 colisiones de version de migracion nuevas.
- Tiempo de query historica critica reducido >= 25%.

## Sprint 6 - Offline-first de clase mundial
**Objetivo:** ampliar offline real mas alla de flujos basicos.

**Entregables:**
- Cobertura de eventos offline para mas dominios (orders/transfers/payments prioritarios).
- UX de conflictos con resolucion guiada.
- Idempotencia reforzada en jobs/proyecciones.
- Base para convergencia automatica (ledger + deltas semanticos) en dominios criticos.

**DoD/KPIs:**
- Tasa de sincronizacion exitosa > 99.5% en pruebas de red intermitente.
- Conflictos sin resolver < 0.5% de eventos.

### Sprint 6.1 - Convergencia CRDT + Escrow (Nivel Oro)
**Objetivo:** consistencia eventual fuerte sin revisiones manuales en caja/inventario.

**Entregables:**
- **Caja (Ledger + PN-Counter):** ledger inmutable de transacciones + saldo derivado por PN-Counter.
- **Inventario (Deltas Semanticos):** eventos de movimiento (+x/-x), prohibido enviar "stock final".
- **Escrow de stock (cuotas por nodo):** cupos asignados por SKU; transferencias de cupo solo online.
- **Politica de sobreventa (opcional):** permitir negativos temporales solo si el negocio lo acepta.
- **Idempotencia universal:** `event_id` + `request_id` obligatorios y dedupe server-side/queue.
- **Causalidad de caja:** Lamport clocks para apertura/cierre y eventos de control.
- **MVR reducido:** MVR solo para metadata no conmutativa; precios con LWW determinista + auditoria.

**PoC (validacion 3 dias):**
1. **Caja (PN-Counter):** 3 dispositivos offline -> 100 transacciones -> saldo converge sin intervencion.
2. **Inventario (Escrow + Deltas):** 3 dispositivos venden mismo SKU con stock limitado -> no oversell si hay cupos; si hay politica negativa, converge con deficit exacto.

**DoD/KPIs:**
- Convergencia 100% en PoC (saldo e inventario iguales en todos los nodos).
- Eventos duplicados = 0 (dedupe efectivo).
- Uso de red reducido (>= 40% vs sync de entidades completas).
- Oversell = 0 cuando Escrow activo.

**Referencias de ejecucion (E2E):**
- ADR: `docs/architecture/adr/ADR-007-crdt-escrow-convergence.md`
- Plan E2E: `docs/roadmap/SPRINT_6_1_CRDT_ESCROW_EXECUTION.md`

## Sprint 7 - Performance comercial
**Objetivo:** convertir velocidad en ventaja competitiva visible.

**Entregables:**
- Plan de chunking real (route/domain split), limpieza import dinamico/estatico redundante.
- Reduccion de chunk principal y mejora de TTI.
- Optimizacion de queries y cache API para dashboard/POS.

**DoD/KPIs:**
- `react-vendor` < 900 KB minificado.
- TTI en dispositivo medio < 2.5s.
- Operaciones POS frecuentes < 120ms local.

## Sprint 8 - Observabilidad y SRE
**Objetivo:** operacion predecible a escala.

**Entregables:**
- Instrumentacion OpenTelemetry (API + colas + frontend clave).
- Dashboards SLO: disponibilidad, latencia, sync success rate.
- Alertas accionables + runbooks de incidentes.

**DoD/KPIs:**
- MTTD < 5 min, MTTR < 30 min en incidentes simulados.
- Error budget definido y monitoreado por servicio critico.

## Sprint 9 - Seguridad y confianza enterprise
**Objetivo:** convertir seguridad en ventaja de venta.

**Entregables:**
- Cerrar vulnerabilidades high/moderate priorizadas.
- Checklist ASVS L2 aplicado a modulos criticos.
- Endurecimiento de secretos, sesiones, auditoria y dependencias.

**DoD/KPIs:**
- Vulnerabilidades HIGH = 0.
- Hallazgos criticos de pentest interno = 0.

## Sprint 10 - Diferenciacion competitiva y lanzamiento Linea A
**Objetivo:** transformar capacidad tecnica en propuesta comercial irresistible.

**Entregables:**
- "Modo Operacion Continua" (offline resiliente + reconciliacion automatica).
- "Copiloto Comercial" (reabastecimiento sugerido, alertas de margen/anomalias).
- Programa piloto controlado + playbook de rollout.

**DoD/KPIs:**
- Exito piloto >= 95% en tiendas objetivo.
- Mejora medible de rotacion/merma/margen en piloto.

---

## 6) Quality Gates globales por sprint (obligatorios)

1. **Arquitectura:** ADR actualizado para cambios de alto impacto.
2. **Codigo:** lint y typecheck verdes en apps afectadas.
3. **Pruebas:** unit + integration + smoke e2e en rutas criticas.
4. **Seguridad:** escaneo de dependencias y secretos.
5. **Operacion:** metricas y logs de nuevas rutas/servicios.
6. **Datos:** scripts de migracion con rollback probado.

---

## 7) Riesgos y mitigaciones

1. **Riesgo:** refactor grande frene roadmap funcional.  
   **Mitigacion:** feature flags + migracion por vertical slices.

2. **Riesgo:** deuda historica de migraciones genere bloqueos en produccion.  
   **Mitigacion:** entornos de rehearsal + pipeline de migracion versionado.

3. **Riesgo:** duplicacion frontend reaparezca.  
   **Mitigacion:** regla de arquitectura en CI (no-copy policy + shared package enforcement).

4. **Riesgo:** sobrecarga por alcance competitivo.  
   **Mitigacion:** priorizacion por valor de negocio + tablero de KPIs quincenal.

---

## 8) Plan de arranque inmediato (primeras 2 semanas)

1. Corregir build blocker Desktop (`apps/desktop/src/lib/api.ts`).
2. Arreglar test harness PWA y dependencias faltantes.
3. Crear workflow CI unificado y quality gates minimos.
4. Crear carpeta de ADRs (`docs/architecture/adr/`) con ADR-001..006.
5. Definir arquitectura de `packages/ui-core` y `packages/app-core`.

---

## 9) Fuentes externas utilizadas (benchmark arquitectura)

- AWS Well-Architected Framework (6 pilares).
- Google Cloud Architecture Framework (patrones de resiliencia y desacoplamiento).
- Google Cloud ADR guidance (Architecture Decision Records).
- Microsoft Azure Architecture Center (architecture styles, CQRS).
- Martin Fowler (Monolith First).
- AWS Prescriptive Guidance (Event Sourcing pattern).
- PostgreSQL docs (Row Security Policies, Partitioning).
- Supabase docs (RLS guide/performance).
- React Router docs (automatic code splitting).
- BullMQ docs (idempotent jobs).
- OpenTelemetry project/docs.
- Google SRE Workbook (error budgets).
- DORA open source metrics reference.
- OWASP ASVS 5.0.
- MDN Service Workers.

---

## Cierre ejecutivo

Velox ya tiene una base muy superior a muchos POS del mercado.  
Lo que falta para Linea A no es "mas features sueltas": es **arquitectura disciplinada + calidad operacional + velocidad de ejecucion**.

Si ejecutamos este plan de 10 sprints con rigor, Velox pasa de "producto prometedor" a **plataforma dominante**.

---

## Bitacora tecnica (2026-02-05)

- Se agrego endpoint de observabilidad de federacion: `GET /sync/federation/status` (cola, probe remoto y ultimo error de relay).
- Se agrego bridge de ventas online (`/sales`) para emitir `SaleCreated` y encolar relay de federacion, evitando que solo sincronice el flujo `/sync/push`.
- Se corrigio CORS para clientes desktop Tauri (`http://tauri.localhost` y `https://tauri.localhost`) y se elimino throw en callback de CORS para evitar respuestas 500 en preflight.
- Se agrego endpoint de recuperacion historica de ventas por ID:
  - `POST /sync/federation/replay-sales`
  - body: `{ "sale_ids": ["uuid1", "uuid2"] }`
  - Funcion: vuelve a encolar `SaleCreated` existentes para relay federado y cerrar desfases historicos entre local y render.
- Se agrego reconciliacion automatica de desfase federado (cron cada 10 minutos):
  - compara IDs de ventas e inventario (movements `StockReceived`/`StockAdjusted`) entre nodos via endpoints federados.
  - auto-dispara replay bidireccional por lotes para cerrar drift.
  - endpoint manual de control: `POST /sync/federation/auto-reconcile`.
  - endpoints de soporte:
    - `GET /sync/federation/sales-ids`
    - `GET /sync/federation/inventory-movement-ids`
    - `POST /sync/federation/replay-inventory`
- Desktop (Tauri) reforzado para tunel interno Tailscale/WireGuard:
  - `apps/desktop/src/lib/api.ts` prioriza URLs de failover configuradas tambien en modo dev (evita caer por defecto a `http://localhost:3000` cuando hay `VITE_PRIMARY_API_URL`).
  - `apps/desktop/src/services/connectivity.service.ts` elimina fallback hardcodeado y hace probes sobre la cadena real de endpoints (primary/fallback/tertiary).
  - `apps/desktop/src-tauri/src/sidecar.rs` ahora carga variables desde entorno y `apps/desktop/.env` (`../.env`) para iniciar sidecar de forma consistente en Win/Mac.
