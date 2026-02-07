# Sprint 2: Plan Tecnico de Unificacion End-to-End

Fecha: 2026-02-07
Alcance: apps/pwa + packages (ui-core, app-core, api-client)
Objetivo: convertir PWA + Desktop en una sola plataforma compartiendo UI, logica y contratos.

## 1) Resumen tecnico
Este sprint consolida la arquitectura de paquetes compartidos para eliminar duplicacion de tipados, servicios y componentes, y establecer un unico punto de verdad. Se prioriza: (1) contratos (tipos/interfaces), (2) capa de comunicacion (api-client), (3) logica de negocio (servicios), (4) UI atomica y de negocio. El resultado es un flujo de desarrollo unificado, menor riesgo de drift y mejor mantenibilidad.

## 2) Objetivos medibles
- Unificar contratos: tipos e interfaces globales viven en `packages/app-core`.
- Unificar cliente API: `apps/pwa/src/lib/api.ts` migrado o reemplazado por `packages/api-client`.
- Extraer logica de negocio critica: `sync.service.ts`, `sales.service.ts`, `products.service.ts` en `packages/app-core`.
- UI compartida: componentes atomicos y de negocio movidos a `packages/ui-core` con importacion desde PWA.
- Eliminar duplicacion y remover scripts de copia manual.

## 3) No objetivos
- No se reescribe la logica de negocio. Solo se mueve y se encapsula.
- No se cambia comportamiento funcional ni se modifica UI/UX.
- No se migra todo el codigo; solo los dominios definidos abajo.

## 4) Arquitectura objetivo
- `packages/api-client`
  - Cliente HTTP unificado, interceptores, auth/headers, errores, retry/backoff.
  - Exporta funciones tipadas y el API surface canonico.
- `packages/app-core`
  - Tipos/Interfaces globales (ventas, inventario, caja, sync, usuarios).
  - Servicios de negocio (ventas, productos, sync) con dependencias inyectables.
  - Utils transversales (logger, permissions, uuid si aplica a dominio).
- `packages/ui-core`
  - UI atomica (shadcn, botones, inputs, cards, modals basicos).
  - UI de negocio (CheckoutModal, SalesTable, etc.) con interfaces del app-core.
- `apps/pwa`
  - Solo orquestacion, rutas, layouts, wiring y adaptadores especificos del PWA.

## 5) Inventario y mapeo inicial
- `apps/pwa/src/lib/api.ts` -> `packages/api-client/src` (compat temporal con re-export).
- Tipos e interfaces duplicadas en PWA -> `packages/app-core/src/types`.
- Servicios grandes:
  - `sync.service.ts` -> `packages/app-core/src/services/sync`.
  - `sales.service.ts` -> `packages/app-core/src/services/sales`.
  - `products.service.ts` -> `packages/app-core/src/services/products`.
- UI:
  - Atomicos: `apps/pwa/src/components/ui` -> `packages/ui-core/src/ui`.
  - Negocio: `apps/pwa/src/components/<dominio>` -> `packages/ui-core/src/features/<dominio>`.

## 6) Estrategia de migracion
1) Contratos (tipos/interfaces)
   - Crear estructura en `app-core` y mover tipados.
   - Exponer barrel exports y ajustar imports en PWA.
   - Meta: eliminar tipados duplicados de PWA.

2) api-client
   - Migrar `api.ts` y utilidades (logger/permissions/uuid si son cross-app).
   - Crear wrapper en PWA (re-export) para compatibilidad temporal.
   - Ajustar imports progresivos hacia `api-client`.

3) Servicios de negocio
   - Extraer por dominio con limites claros (entrada/salida tipada).
   - Introducir adaptadores del PWA si hay dependencias del runtime.
   - Validar que no haya accesos directos a UI o storage especifico sin adapter.

4) UI atomica y de negocio
   - Atomicos primero (shadcn + primitives).
   - Negocio despues (CheckoutModal, tablas, flows complejos).
   - Mantener styles/tokens alineados con PWA.

5) Limpieza
   - Eliminar scripts de copia manual y referencias antiguas.
   - Remover archivos duplicados, actualizar docs.

## 7) Dependencias y orden de trabajo
- Bloqueante: tipados en `app-core` antes de mover servicios.
- Bloqueante: `api-client` antes de migrar servicios que lo usen.
- UI depende de contratos ya estables en `app-core`.

## 8) Criterios de aceptacion
- PWA compila sin imports locales a los antiguos archivos movidos.
- No existen tipados duplicados entre PWA y packages.
- Servicios grandes viven en `app-core` y tienen API publica estable.
- UI importada desde `ui-core` en rutas principales.
- No hay scripts de copia manual.

## 9) Riesgos y mitigaciones
- Riesgo: imports circulares entre `app-core` y `ui-core`.
  - Mitigacion: `ui-core` depende solo de tipos, no de servicios.
- Riesgo: dependencias del runtime (localStorage, navigator).
  - Mitigacion: inyectar adaptadores desde PWA.
- Riesgo: divergencia temporal entre PWA y packages.
  - Mitigacion: wrapper temporal y migracion progresiva por dominio.

## 10) Testing y verificacion
- Build de PWA y typecheck sin errores.
- Tests existentes corren sin cambios.
- Smoke test manual de flujos: ventas, sync, productos, checkout.
- Validar que el PWA no dependa de imports internos antiguos.

## 11) Plan de rollout
- Migracion por lotes, cada lote con PR aislado.
- Mantener re-exports temporales hasta completar ajustes.
- Eliminar compatibilidad temporal al cierre del sprint.

## 12) Checklist tecnico final
- [ ] Tipos e interfaces en `packages/app-core`.
- [ ] `api-client` unificado y usado por PWA.
- [ ] Servicios grandes migrados con adaptadores.
- [ ] UI atomica y de negocio en `ui-core`.
- [ ] Eliminados duplicados y scripts manuales.
- [ ] Smoke tests y build ok.
