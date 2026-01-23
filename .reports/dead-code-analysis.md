# Análisis de Código Muerto - LA-CAJA

**Fecha de Análisis:** 2026-01-22  
**Analista:** @refactor-cleaner Agent  
**Herramientas:** knip, depcheck, ts-prune

---

## Resumen Ejecutivo

Análisis completo de código muerto en el sistema LA-CAJA usando herramientas especializadas. Se identificaron archivos no usados, dependencias no usadas y exports no usados.

**Estado:** ✅ ANÁLISIS COMPLETO

**Resumen:**
- 🟢 **Archivos no usados:** 38
- 🟢 **Dependencias no usadas:** 18
- 🟢 **DevDependencies no usadas:** 11
- 🟡 **Dependencias no listadas:** 4
- 🟡 **Exports no usados:** 208

---

## Herramientas Utilizadas

✅ **knip** - Find unused files, exports, dependencies, types  
✅ **depcheck** - Identify unused npm dependencies  
✅ **ts-prune** - Find unused TypeScript exports

**Instalación:** ✅ Completada  
**Reportes generados:** `.reports/knip-report.txt`, `.reports/depcheck-report.txt`, `.reports/ts-prune-report.txt`

---

## Resultados del Análisis

### 1. Archivos No Usados (38 archivos)

#### 🟢 SAFE - Eliminar con Confianza

**Backend:**
- `apps/api/check-code.js` - Script de verificación
- `apps/api/src/common/decorators/api-docs.decorator.ts` - Decorador no usado
- `apps/api/src/inventory/dto/stock-status.dto.ts` - DTO no usado
- `apps/api/src/sales/pipes/clean-sale-dto.pipe.ts` - Pipe no usado

**Frontend PWA:**
- `apps/pwa/src/App.css` - CSS no usado
- `apps/pwa/src/pages/LandingPage.tsx` - Reemplazado por LandingPageEnhanced
- `apps/pwa/src/components/discounts/DiscountAuthorizationModal.tsx` - Componente no usado
- `apps/pwa/src/components/landing/OptimizedMotion.tsx` - Componente no usado
- `apps/pwa/src/components/loader/AdvancedParticleLoader.tsx` - Componente no usado
- `apps/pwa/src/components/loader/ParticleLoader.tsx` - Componente no usado
- `apps/pwa/src/components/notifications/index.ts` - Index no usado
- `apps/pwa/src/components/notifications/NotificationBell.tsx` - Componente no usado
- `apps/pwa/src/components/notifications/NotificationsPanel.tsx` - Componente no usado
- `apps/pwa/src/components/seo/SEOHead.tsx` - Componente no usado
- `apps/pwa/src/components/ui/empty-state.tsx` - Componente no usado
- `apps/pwa/src/components/ui/page-loader.tsx` - Componente no usado
- `apps/pwa/src/components/ui/sync-status.tsx` - Componente no usado
- `apps/pwa/src/components/ui/toast.tsx` - Componente no usado
- `apps/pwa/src/hooks/use-modal-form.ts` - Hook no usado
- `apps/pwa/src/hooks/use-modal.ts` - Hook no usado
- `apps/pwa/src/hooks/use-products-cache.ts` - Hook no usado
- `apps/pwa/src/hooks/use-sync.ts` - Hook no usado
- `apps/pwa/src/hooks/useNotificationBadge.ts` - Hook no usado
- `apps/pwa/src/hooks/useSplitPayment.ts` - Hook no usado
- `apps/pwa/src/hooks/useUnsavedChanges.ts` - Hook no usado
- `apps/pwa/src/services/ab-testing.service.ts` - Servicio no usado
- `apps/pwa/src/services/analytics.service.ts` - Servicio no usado
- `apps/pwa/src/services/contact.service.ts` - Servicio no usado
- `apps/pwa/src/services/offline-indicator.service.ts` - Servicio no usado
- `apps/pwa/src/sw/background-sync-handler.ts` - Handler no usado
- `apps/pwa/src/utils/accessibility.ts` - Utilidad no usada

**Desktop:**
- `apps/desktop/src/App.css` - CSS no usado
- `apps/desktop/src/components/ui/collapsible.tsx` - Componente no usado
- `apps/desktop/src/lib/utils.ts` - Utilidad no usada

**Build/Dev:**
- `apps/pwa/dev-dist/registerSW.js` - Archivo de desarrollo
- `apps/pwa/dev-dist/sw.js` - Service worker de desarrollo
- `apps/pwa/dev-dist/workbox-1ed862ea.js` - Workbox de desarrollo
- `apps/pwa/public/sw-push.js` - Service worker push no usado

### 2. Dependencias No Usadas (18 dependencias)

#### 🟢 SAFE - Eliminar con Confianza

**Backend (apps/api):**
- `@bull-board/api` - Bull board no usado
- `@bull-board/nestjs` - Bull board NestJS no usado
- `@nestjs/bull` - Bull queue no usado
- `bull` - Bull queue no usado
- `i18next` - Internacionalización no usada
- `pino-pretty` - Logger pretty no usado
- `uuid` - UUID no usado

**Frontend Desktop:**
- `@radix-ui/react-collapsible` - Componente no usado
- `class-variance-authority` - Utilidad no usada
- `clsx` - Utilidad no usada
- `dexie-react-hooks` - Hooks no usados
- `tailwind-merge` - Utilidad no usada

**Frontend PWA:**
- `@radix-ui/react-toast` - Toast no usado
- `dexie-react-hooks` - Hooks no usados
- `react-helmet-async` - SEO no usado
- `react-hot-toast` - Toast no usado

**Root:**
- `react-helmet-async` - Duplicado en root

**Packages:**
- `@la-caja/domain` - Package no usado en application

### 3. DevDependencies No Usadas (11)

#### 🟡 CAUTION - Verificar Antes de Eliminar

**Backend:**
- `@types/supertest` - Types para testing (puede usarse en futuro)
- `@types/uuid` - Types para UUID (puede usarse en futuro)
- `source-map-support` - Support para source maps
- `supertest` - Testing (puede usarse en futuro)
- `ts-loader` - Loader para webpack (puede usarse en build)
- `tsconfig-paths` - Paths para TypeScript

**Frontend Desktop:**
- `@types/uuid` - Types para UUID

**Frontend PWA:**
- `@testing-library/user-event` - Testing (puede usarse en futuro)
- `@types/uuid` - Types para UUID

**Root:**
- `depcheck` - Herramienta de análisis (mantener)
- `ts-prune` - Herramienta de análisis (mantener)

**Nota:** Algunas devDependencies pueden ser necesarias para builds o testing futuro.

### 4. Dependencias No Listadas (4)

#### 🔴 DANGER - Agregar a package.json

Estas dependencias se usan pero no están en package.json:

- `fastify` - Usado en `apps/api/src/health/health.controller.ts`
- `@hapi/boom` - Usado en `apps/api/src/whatsapp/whatsapp-bot.service.ts`
- `@radix-ui/react-collapsible` - Usado en `apps/pwa/src/components/ui/collapsible.tsx`
- `@radix-ui/react-visually-hidden` - Usado en `apps/pwa/src/components/ui/visually-hidden.tsx`

**Acción Requerida:** Agregar estas dependencias a los package.json correspondientes.

### 5. Exports No Usados (208 exports)

#### 🟡 CAUTION - Verificar Antes de Eliminar

**Categorías:**

1. **Templates de Contabilidad (4):**
   - `retailTemplate`, `servicesTemplate`, `restaurantTemplate`, `generalTemplate`
   - **Verificar:** Pueden usarse dinámicamente

2. **Entidades TypeORM (Muchas):**
   - Todas las entidades exportadas desde `apps/api/src/database/entities/index.ts`
   - **Verificar:** TypeORM puede usar estas entidades dinámicamente
   - **⚠️ NO ELIMINAR:** Estas son parte de la API pública de entidades

3. **Funciones de Utilidad:**
   - `bankerRound` en exchange.service.ts
   - Funciones en accounting-advanced-algorithms.ts
   - **Verificar:** Pueden usarse internamente

4. **Componentes Aceternity:**
   - Varios componentes de UI
   - **Verificar:** Pueden usarse en LandingPageEnhanced

**Recomendación:** Revisar cada export individualmente antes de eliminar.

### Categorización por Riesgo

#### 🟢 SAFE (Eliminar con Confianza)
- Imports no usados
- Variables declaradas pero no usadas
- Tipos importados pero no usados

#### 🟡 CAUTION (Verificar Antes de Eliminar)
- Exports que podrían usarse dinámicamente
- Funciones en archivos grandes que podrían usarse indirectamente
- DTOs que podrían usarse en validaciones

#### 🔴 DANGER (NO Eliminar Sin Análisis Profundo)
- Event handlers (event sourcing)
- Sync service code (offline-first)
- Multi-tenant isolation code (store_id filtering)
- CRDT conflict resolution
- Projection code
- Public API exports

---

## Archivos Potencialmente No Usados

### Requiere Análisis con Herramientas

**Backend:**
- Verificar servicios obsoletos
- Verificar DTOs no usados
- Verificar guards/interceptors no usados

**Frontend:**
- Verificar componentes no usados
- Verificar hooks no usados
- Verificar servicios no usados

**Packages:**
- Verificar exports no usados en packages compartidos

---

## Dependencias Potencialmente No Usadas

### Requiere Análisis con depcheck

**Recomendación:**
1. Ejecutar `npx depcheck`
2. Revisar cada dependencia reportada
3. Verificar si se usa en:
   - Imports directos
   - Configuraciones (vite.config, tsconfig, etc.)
   - Scripts
   - Type definitions

---

## Plan de Acción - FASE 3

### Paso 1: Eliminar Archivos SAFE (38 archivos)

**Prioridad:** 🔴 ALTA

1. Eliminar archivos de desarrollo/build no usados
2. Eliminar componentes/hooks/servicios no usados
3. Verificar build después de cada batch
4. Documentar en `docs/DELETION_LOG.md`

### Paso 2: Eliminar Dependencias SAFE (18 dependencias)

**Prioridad:** 🟡 MEDIA

1. Eliminar dependencias no usadas
2. Verificar que no se usan en configuraciones
3. Ejecutar `npm install` después
4. Verificar build

### Paso 3: Agregar Dependencias No Listadas (4)

**Prioridad:** 🔴 ALTA

1. Agregar `fastify` a `apps/api/package.json`
2. Agregar `@hapi/boom` a `apps/api/package.json`
3. Agregar `@radix-ui/react-collapsible` a `apps/pwa/package.json`
4. Agregar `@radix-ui/react-visually-hidden` a `apps/pwa/package.json`
5. Ejecutar `npm install`

### Paso 4: Revisar Exports No Usados (208)

**Prioridad:** 🟢 BAJA

1. Revisar cada export individualmente
2. Verificar uso dinámico
3. Verificar si es parte de API pública
4. Eliminar solo los que estén 100% seguros

### Paso 5: Revisar DevDependencies (11)

**Prioridad:** 🟢 BAJA

1. Mantener herramientas de análisis (depcheck, ts-prune)
2. Revisar si testing dependencies se usarán
3. Eliminar solo las que estén 100% seguras

---

## Checklist de Seguridad

Antes de eliminar CUALQUIER código:

- [ ] Verificado con grep que no se usa
- [ ] Verificado imports dinámicos
- [ ] Verificado si es parte de API pública
- [ ] Verificado git history para contexto
- [ ] Verificado tests (si existen)
- [ ] Verificado build después de eliminar
- [ ] Documentado en DELETION_LOG.md

---

## Resumen Ejecutivo

### Hallazgos Totales

| Categoría | Cantidad | Prioridad | Estado |
|-----------|----------|-----------|--------|
| Archivos no usados | 38 | 🔴 ALTA | Listo para eliminar |
| Dependencias no usadas | 18 | 🟡 MEDIA | Listo para eliminar |
| DevDependencies no usadas | 11 | 🟢 BAJA | Revisar antes |
| Dependencias no listadas | 4 | 🔴 ALTA | Agregar a package.json |
| Exports no usados | 208 | 🟢 BAJA | Revisar individualmente |

### Impacto Estimado

- **Reducción de bundle size:** ~500KB (estimado)
- **Reducción de dependencias:** 18 packages
- **Líneas de código eliminadas:** ~5,000+ (estimado)
- **Tiempo de build:** Mejora marginal

### Conclusión

El análisis completo identifica oportunidades significativas de limpieza. Se recomienda proceder con la eliminación de archivos y dependencias SAFE en FASE 3.

**Próximos Pasos:** Ver FASE 3 del plan de robustecimiento para eliminación segura.

---

**Reportes Completos:**
- `.reports/knip-report.txt` - Análisis completo de knip
- `.reports/depcheck-report.txt` - Análisis de dependencias
- `.reports/ts-prune-report.txt` - Análisis de exports TypeScript
