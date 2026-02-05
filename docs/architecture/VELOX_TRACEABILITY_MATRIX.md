# Velox POS - Traceability Matrix (README vs. Código)

Objetivo: verificar qué afirma el README y dónde vive en el código. Incluye estado realista y notas.

**Leyenda**
- ✅ Implementado y activo
- 🟡 Parcial / necesita hardening o cobertura completa
- ⚠️ Gap / no encontrado o no operativo

## Matriz (alto nivel)

| Claim (README) | Evidencia en código | Estado | Notas |
| --- | --- | --- | --- |
| Offline-first real (ventas/stock/caja sin red) | `apps/pwa/src/services/sync.service.ts`, `apps/desktop/src/services/sync.service.ts`, `packages/offline-core`, `apps/desktop/src/services/sqlite.service.ts`, `apps/pwa/src/db` | ✅ | Persistencia local + cola offline + reintentos. |
| Sync por eventos (push/pull + reconcile) | `apps/api/src/sync/sync.service.ts`, `apps/api/src/sync/sync.controller.ts`, `apps/pwa/src/services/sync.service.ts`, `apps/desktop/src/services/sync.service.ts` | ✅ | Push/pull y reconciliación base en cliente. |
| Vector clocks | `packages/offline-core/src/vector-clock.ts`, `apps/api/src/sync/vector-clock.service.ts`, `apps/api/src/database/migrations/35_offline_first_world_class*.sql` | ✅ | Se usa en eventos y en sync. |
| Resolución de conflictos / CRDT | `apps/api/src/sync/conflict-resolution.service.ts`, `apps/api/src/sync/crdt.service.ts` | 🟡 | LWW + lógica por evento; no es CRDT completo para todos los dominios. |
| Event Store central | `apps/api/src/database/entities/event.entity.ts`, `apps/api/src/database/migrations/001_initial_schema.sql`, `apps/api/src/sync/sync.service.ts` | ✅ | Tabla `events` y escritura en sync. |
| Proyecciones async (BullMQ) | `apps/api/src/sales/queues/sales-projection.queue.ts`, `apps/api/src/projections/projections.service.ts` | ✅ | Proyección de ventas + efectos. |
| Inventario proyectado desde eventos | `apps/api/src/projections/projections.service.ts` (StockReceived/StockAdjusted), `apps/api/src/database/entities/inventory-movement.entity.ts` | ✅ | Inventory Movement se deriva de eventos. |
| Sales post-processing (fiscal, accounting) | `apps/api/src/sales/queues/sales-post-processing.queue.ts`, `apps/api/src/sales/application/commands/create-sale/create-sale.handler.ts` | ✅ | Encola post-proceso y efectos. |
| Notificaciones async (email/WhatsApp) | `apps/api/src/notifications/queues/notifications.queue.ts`, `apps/api/src/whatsapp/whatsapp-messaging.service.ts` | ✅ | Cola dedicada + integración. |
| Federacion (central <-> local) | `apps/api/src/sync/federation-sync.service.ts`, `apps/api/src/sync/sync.controller.ts` | ✅ | Relay + replay + endpoints. |
| Auto-reconcile entre nodos | `apps/api/src/sync/federation-sync.service.ts` (`runAutoReconcile`) | 🟡 | Existe pero depende de ejecución/trigger; no se ve scheduler global por defecto. |
| Background Sync en PWA | `apps/pwa/src/sw.ts` | ✅ | Background Sync + Service Worker. |
| Observabilidad (metrics/health) | `apps/api/src/metrics/metrics.service.ts`, `apps/api/src/health/health.controller.ts` | ✅ | Health endpoints + métricas. |
| Auth + Licencias | `apps/api/src/auth`, `apps/api/src/licenses`, `apps/api/src/security` | ✅ | Validación y gates de licencia. |
| Multicanal (PWA/Desktop/Android) | `apps/pwa`, `apps/desktop`, `app/` + `build.gradle` | ✅ | Canales existentes. |
| Desktop offline DB SQLite | `apps/desktop/src/services/sqlite.service.ts`, `apps/desktop/src/db/repositories/sqlite/*` | ✅ | Persistencia local. |
| PWA offline DB IndexedDB/Dexie | `apps/pwa/src/db`, `apps/pwa/src/services/*` | ✅ | Persistencia local. |
| Realtime WebSockets | `apps/api/src/realtime-analytics`, `apps/api/src/notifications`, `apps/pwa/src/services/realtime-websocket.service.ts`, `apps/desktop/src/services/realtime-websocket.service.ts` | ✅ | Canales realtime en UI y API. |
| Reportes/analytics | `apps/api/src/reports`, `apps/api/src/realtime-analytics`, `apps/pwa/src/pages/ReportsPage.tsx` | ✅ | Reportes y analítica en backend + UI. |
| Auto-corrección total de DBs | No hay motor global identificado | 🟡 | Hay replay + reconcile por dominios, pero falta loop global con garantías. |

## Gaps reales observados (de lo que piden en campo)

1) **Inventario no sincroniza automaticamente en algunos flujos**
   - Probable gap en emisión de eventos `StockReceived/StockAdjusted` desde la UI offline o en encolado de esos eventos.
   - Requiere inspección de `apps/pwa/src/services/inventory.service.ts`, `apps/desktop/src/services/inventory.service.ts` y su integración con `sync.service.ts`.

2) **Auto-reconcile global (ventas + inventario + caja) no programado**
   - Existe endpoint y lógica para `runAutoReconcile`, pero no hay evidencia de scheduler permanente por store.

3) **Convergencia total no garantizada**
   - Hay LWW + replay, pero falta un reconciliador determinista por dominio (y tests de convergencia).

## Siguiente paso recomendado (si quieres)
- Convertir este doc en checklist viva con pruebas automatizadas por dominio.
- Agregar `scripts/sync-reconcile` para disparar `auto-reconcile` por store con cron.
- Pruebas de convergencia: ventas + inventario + caja en escenarios offline.

