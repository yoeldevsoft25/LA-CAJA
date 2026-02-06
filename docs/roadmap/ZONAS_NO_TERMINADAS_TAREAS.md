# Zonas no terminadas – Tareas concretas

**Origen:** [VELOX_POS_LINEA_A_SPRINTS_2026.md](./VELOX_POS_LINEA_A_SPRINTS_2026.md)  
**Objetivo:** Convertir cada zona en progreso o pendiente en tareas ejecutables y verificables.

---

## Resumen por sprint

| Sprint | Estado | Foco de tareas |
|--------|--------|----------------|
| 1 | 🟡 Cierre | Entorno local + CI estándar |
| 5 | 🟡 Continuación | 5.3 Test migraciones con datos + partición/archivado |
| 6 | ⏳ Base + 6.1/6.2 | Offline ampliado + CRDT (docs ya existen) |
| 7 | 🟡 Pendiente | Chunking + bundle + TTI |
| 8 | ⏳ Pendiente | OpenTelemetry + SLO + runbooks |
| 9 | ⏳ Pendiente | Vulnerabilidades + ASVS L2 |
| 10 | ⏳ Pendiente | Modo continuidad + Copiloto + piloto |

---

## Sprint 1 – Cierre (deudas menores)

**Objetivo:** 100% builds verdes en CI, 0 bloqueos de script/dependencia.

**Hecho (sin tocar código de aplicación):** ENTORNO_LOCAL.md, script `scripts/check-env.sh`, POLITICA_LINT.md, enlace en README e INSTALL a entorno y verificación CI. Falta ejecutar en tu máquina: builds + tests + lint (ver ENTORNO_LOCAL.md) y corregir solo si algo falla.

### 1.1 Entorno local

- [x] Documentar en `docs/development/` requisitos de entorno (Node 20, npm ci, variables opcionales): **ENTORNO_LOCAL.md**.
- [ ] Verificar que `npm run dev:api`, `dev:pwa`, `dev:desktop` arrancan sin errores en README.
- [x] Script `scripts/check-env.sh` para verificar Node y .nvmrc (ejecutar desde raíz; si falla: `chmod +x scripts/check-env.sh`).

### 1.2 CI en la cuenta principal

- [ ] Confirmar que el workflow en `.github/workflows/ci.yml` corre en push/PR a `main`/`develop`.
- [ ] Si Desktop falla por tipado (`apps/desktop/src/lib/api.ts`): corregir y dejar build Desktop en verde.
- [ ] Si PWA tests fallan por `@testing-library/dom`: añadir dependencia en `apps/pwa/package.json` y dejar `npm run test --workspace=apps/pwa -- --run` en verde.
- [ ] Si PWA lint falla (50 errores, 20 warnings): definir si se baja a 0 o se usa baseline temporal; actualizar `lint:ratchet` si aplica.
- [ ] Añadir job de Test Desktop en CI si falta: `npm run test:run --workspace=apps/desktop`.
- [ ] DoD: pipeline único (build + test + lint) verde para API, PWA y Desktop.

---

## Sprint 5 – Continuación (5.3 y cierre)

**Objetivo:** Test de migraciones con datos reales + plan de partición/archivado operativo.

### 5.3 Test automatizado de migración con datos

- [ ] Script o job que ejecuta migraciones en entorno “con datos” (ej. DB con datos seed o copia anónima).
- [ ] Documentar en `docs/development/` o `docs/deployment/` cómo ejecutar “rehearsal con datos”.
- [ ] Incluir en CI o en checklist de release: migración en limpio + migración con datos sin fallos.

### 5.4 Plan de partición y archivado (events)

- [ ] Definir política de archivado: antigüedad para mover `events` a partición fría o histórico (ej. >90 días).
- [ ] Migraciones o jobs que crean particiones por rango de tiempo (mensual/trimestral) si no están.
- [ ] Documentar en ADR o en `docs/architecture/` el plan de partición y retención.
- [ ] DoD: tiempo de query histórica crítica reducido ≥25% (medir antes/después).

### 5.5 Separación migración vs data-fix

- [ ] Guía en `docs/development/` o ADR: cuándo usar migración estructural (V) vs data-fix operacional (D) y dónde viven los scripts.
- [ ] Regla en validador: no mezclar DDL destructivo con DML de corrección en la misma migración.

---

## Sprint 6 – Base (antes de 6.1/6.2)

**Objetivo:** Offline en más dominios + UX de conflictos + idempotencia reforzada.

### 6.0.1 Cobertura offline (orders / transfers / payments)

- [ ] Listar endpoints y flujos de orders, transfers y payments que deben funcionar offline.
- [ ] Asegurar que generan eventos y se encolan en la cola de sync local (IndexedDB).
- [ ] Probar flujo: offline → operación → online → sync exitoso sin pérdida.

### 6.0.2 UX de conflictos

- [ ] Definir modelo de “conflicto” expuesto al usuario (ej. lista de conflictos por entidad/evento).
- [ ] Pantalla o sección “Conflictos pendientes” (o integrada en configuración/sync).
- [ ] Resolución guiada: elegir versión “local” vs “servidor” o “fusionar” según tipo (documentar en UX).

### 6.0.3 Idempotencia en jobs/proyecciones

- [ ] Revisar colas BullMQ críticas: dedupe por `event_id`/`request_id` donde aplique.
- [ ] Proyecciones: skip si evento ya aplicado (version/updated_at o tabla de eventos aplicados).

### 6.1 y 6.2

- **6.1 CRDT + Escrow:** tareas en [SPRINT_6_1_CRDT_ESCROW_TASKS.md](./SPRINT_6_1_CRDT_ESCROW_TASKS.md) y plan en [SPRINT_6_1_CRDT_ESCROW_EXECUTION.md](./SPRINT_6_1_CRDT_ESCROW_EXECUTION.md).
- **6.2 CRDT MAX:** [SPRINT_6_2_CRDT_MAX_TASKS.md](./SPRINT_6_2_CRDT_MAX_TASKS.md), [SPRINT_6_2_CRDT_MAX_EXECUTION.md](./SPRINT_6_2_CRDT_MAX_EXECUTION.md), [SPRINT_6_2_CRDT_MAX_CHECKLIST.md](./SPRINT_6_2_CRDT_MAX_CHECKLIST.md).

---

## Sprint 7 – Performance comercial (concretar)

**Objetivo:** Chunking real, bundle <900 KB react-vendor, TTI <2.5s, POS <120ms local.

### 7.1 Plan de chunking (route/domain)

- [ ] Listar rutas PWA/Desktop y agrupar por dominio (POS, Inventario, Ventas, Contabilidad, etc.).
- [ ] Definir chunks por ruta: lazy de nivel ruta con `React.lazy` + `Suspense` (ya sugerido en [OPORTUNIDADES_LAZY_LOADING.md](../performance/OPORTUNIDADES_LAZY_LOADING.md)).
- [ ] Prioridad 1: POS (CheckoutModal, POSPage), Inventario, Productos (modales grandes).
- [ ] Revisar imports estáticos/dinámicos: eliminar imports pesados que no sean necesarios en carga inicial.

### 7.2 Reducción de bundle

- [ ] Medir tamaño actual de `react-vendor` (y chunk principal) en build de producción.
- [ ] Objetivo: `react-vendor` < 900 KB minificado.
- [ ] Acciones: tree-shaking, sustituir librerías pesadas por alternativas ligeras si aplica, dynamic import de modales grandes (CheckoutModal, ProductFormModal, SaleDetailModal, etc.).

### 7.3 TTI y operaciones locales

- [ ] Medir TTI en dispositivo “medio” (ej. Lighthouse o WebPageTest) antes/después.
- [ ] Objetivo: TTI < 2.5s.
- [ ] Objetivo: operaciones POS frecuentes < 120ms local (medir en dev tools o métrica interna).

### 7.4 API (queries y cache)

- [ ] Identificar queries de dashboard/POS más costosas (logs, APM o manual).
- [ ] Añadir cache donde aplique (HTTP cache, Redis o in-memory en API) y documentar política.
- [ ] Optimizar N+1 o consultas pesadas en endpoints críticos de POS.

---

## Sprint 8 – Observabilidad y SRE (concretar)

**Objetivo:** OpenTelemetry, SLO, alertas y runbooks.

### 8.1 OpenTelemetry

- [ ] Instrumentar API (NestJS): spans por request, por cola/job si aplica.
- [ ] Instrumentar frontend “clave”: al menos flujo de sync y de venta (eventos o spans).
- [ ] Configurar export (ej. console/OTLP) y documentar cómo conectar a backend de trazas.

### 8.2 Dashboards SLO

- [ ] Definir SLOs: disponibilidad (ej. 99.5%), latencia p95, sync success rate.
- [ ] Dashboard (Grafana/similar o proveedor cloud) con métricas de API, colas y sync.
- [ ] Error budget por servicio crítico (ventas, sync, auth).

### 8.3 Alertas y runbooks

- [ ] Alertas accionables: caída de API, cola bloqueada, tasa de fallo de sync alta.
- [ ] Runbooks por incidente tipo: “sync no converge”, “cola llena”, “API 5xx”.
- [ ] DoD: MTTD < 5 min, MTTR < 30 min en simulacros.

---

## Sprint 9 – Seguridad (concretar)

**Objetivo:** 0 HIGH, ASVS L2 en módulos críticos.

### 9.1 Vulnerabilidades

- [ ] `npm audit` (y equivalente para resto de dependencias): listar HIGH/moderate.
- [ ] Plan de cierre: actualizar o parchear hasta HIGH = 0; documentar moderate aceptados si aplica.

### 9.2 ASVS L2

- [ ] Checklist ASVS L2 (OWASP): seleccionar ítems aplicables a auth, sesiones, API, datos.
- [ ] Aplicar a módulos críticos: auth, sync, ventas, pagos; documentar cumplimiento y excepciones.

### 9.3 Endurecimiento

- [ ] Secretos: no en repo; uso de variables de entorno o vault; rotación documentada.
- [ ] Sesiones: expiración, refresh, invalidación en logout.
- [ ] Auditoría: logs de acciones sensibles (login, cambios de rol, acceso a datos críticos).
- [ ] DoD: hallazgos críticos de pentest interno = 0.

---

## Sprint 10 – Diferenciación y lanzamiento (concretar)

**Objetivo:** Modo Operación Continua, Copiloto Comercial, piloto.

### 10.1 Modo Operación Continua

- [ ] Mensaje de producto: “Siempre vendes: offline + reconciliación automática”.
- [ ] Checklist técnico: offline-first en flujos POS, federación y auto-reconcile operativos, sin bloqueos por red.
- [ ] Documentación comercial o de ventas que describa el modo.

### 10.2 Copiloto Comercial

- [ ] Reabastecimiento sugerido: criterios (stock bajo, histórico) y dónde se muestra (UI/notificaciones).
- [ ] Alertas de margen/anomalías: definición de “anomalía” y canal (dashboard, notificaciones).
- [ ] Integración con ML/insights existente si aplica (ej. `NotificationOrchestratorService`).

### 10.3 Piloto y rollout

- [ ] Definir tiendas objetivo y criterios de éxito (≥95% éxito piloto).
- [ ] Métricas: rotación, merma, margen antes/después en piloto.
- [ ] Playbook de rollout: pasos, rollback, soporte.

---

## Orden sugerido de ejecución

1. **Sprint 1 cierre** – poco esfuerzo, desbloquea confianza en CI.
2. **Sprint 7 (plan + primeras optimizaciones)** – impacto visible en velocidad y bundle.
3. **Sprint 5.3–5.5** – cierra Data Platform y evita deuda de migraciones.
4. **Sprint 6 base (6.0.x)** – luego 6.1 y 6.2 según prioridad negocio.
5. **Sprint 8** – en paralelo o tras estabilidad de 6/7.
6. **Sprint 9** – continuo; puede solaparse con 8.
7. **Sprint 10** – cuando 6–9 estén avanzados.

---

## Issues y PRs concretos (Sprint 1 y 7)

Para Sprint 1 (cierre) y Sprint 7 (performance) hay **issues/PRs listos para copiar** en:  
**[ISSUES_PR_SPRINT_1_Y_7.md](./ISSUES_PR_SPRINT_1_Y_7.md)**.

---

## Referencias

- Plan maestro: [VELOX_POS_LINEA_A_SPRINTS_2026.md](./VELOX_POS_LINEA_A_SPRINTS_2026.md)
- Sprint 6.1: [SPRINT_6_1_CRDT_ESCROW_EXECUTION.md](./SPRINT_6_1_CRDT_ESCROW_EXECUTION.md), [SPRINT_6_1_CRDT_ESCROW_TASKS.md](./SPRINT_6_1_CRDT_ESCROW_TASKS.md)
- Sprint 6.2: [SPRINT_6_2_CRDT_MAX_*.md](./SPRINT_6_2_CRDT_MAX_EXECUTION.md)
- Performance: [docs/performance/OPORTUNIDADES_LAZY_LOADING.md](../performance/OPORTUNIDADES_LAZY_LOADING.md)
- CI: [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
