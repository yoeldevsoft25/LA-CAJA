# Offline Mode Progress Checklist

Use this file to mark what is already completed.

Legend:
- [ ] pending
- [x] done

## P0 - Modelo offline-first consistente
- [x] Extender BaseEvent con campos offline-first: vector_clock, causal_dependencies, delta_payload, full_payload_hash. (files: `packages/domain/src/events/event.types.ts`)
- [x] Remover inyeccion con `any` en sync service y usar tipado real. (files: `apps/pwa/src/services/sync.service.ts`)

## P1 - Conflictos end-to-end
- [x] Crear endpoint `POST /sync/resolve-conflict`. (files: `apps/api/src/sync/sync.controller.ts`, `apps/api/src/sync/dto/resolve-conflict.dto.ts`)
- [x] Persistir conflictos manuales en DB (`sync_conflicts`). (files: `apps/api/src/sync/conflict-resolution.service.ts`, método `resolveManualConflict`)
- [ ] Confirmar flujo UI -> API -> DB para resolver conflictos. (files: `apps/pwa/src/pages/ConflictsPage.tsx`) - **Requiere validación manual end-to-end**

## P1 - Cache y datos criticos offline
- [x] Implementar cache local para clientes con fallback offline. (files: `apps/pwa/src/services/customers.service.ts`, `apps/pwa/src/db/database.ts`)
- [x] Integrar CacheManager L1/L2 para entidades criticas. (files: `packages/sync/src/cache-manager.ts`, `apps/pwa/src/services/sync.service.ts`)

## P2 - Background sync (PWA)
- [x] Agregar registro de Background Sync tags en sync.service.ts. (files: `apps/pwa/src/services/sync.service.ts`)

## P2 - QA offline
- [x] Agregar pruebas offline reproducibles. (files: `scripts/test-offline.sh`, `docs/testing/OFFLINE_TESTING_GUIDE.md`)

## P3 - Documentacion
- [x] Actualizar estado "modo offline completo (PWA)". (file: `docs/development/ESTADO_IMPLEMENTACION_COMPLETO.md`)

## Notas
- [x] (17 Enero 2025) Implementación completa de offline-first:
  - ✅ Tipado offline-first completo
  - ✅ Endpoint de resolución de conflictos implementado
  - ✅ Cache offline para clientes implementado
  - ✅ CacheManager integrado en sync service
  - ✅ Background Sync API implementado
  - ✅ Guía de testing offline creada
  - ✅ Documentación actualizada
  - ⚠️ Pendiente: Validación manual end-to-end del flujo de conflictos
