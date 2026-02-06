# Issues y PRs concretos – Sprint 1 (cierre) y Sprint 7 (performance)

**Uso:** Copiar cada bloque como issue en GitHub/GitLab o como tarea en tu tablero.  
**Origen:** [ZONAS_NO_TERMINADAS_TAREAS.md](./ZONAS_NO_TERMINADAS_TAREAS.md)

---

## Sprint 1 – Cierre (CI y entorno)

### Issue S1-1: Documentar requisitos de entorno local

**Título:** `[Sprint 1] Documentar requisitos de entorno local para desarrollo`

**Descripción:**
- Añadir o actualizar una guía en `docs/development/` con: Node 20, `npm ci`, variables de entorno opcionales (ej. `VITE_PRIMARY_API_URL`), y pasos para `dev:api`, `dev:pwa`, `dev:desktop`.
- Opcional: script `scripts/check-env.sh` que verifique Node version y dependencias instaladas.

**Criterios de aceptación:**
- [ ] Existe `docs/development/ENTORNO_LOCAL.md` (o sección en `INSTALL.md`) con los requisitos.
- [ ] Un desarrollador nuevo puede seguir la guía y arrancar los tres entornos sin pasos implícitos.

**Labels:** `sprint-1`, `docs`, `onboarding`

---

### Issue S1-2: Verificar y corregir build Desktop en CI

**Título:** `[Sprint 1] Asegurar build Desktop en verde en CI`

**Descripción:**
- El roadmap mencionó fallo de tipado en `apps/desktop/src/lib/api.ts`. Verificar que `npm run build --workspace=apps/desktop` pasa en local y en el workflow `.github/workflows/ci.yml`.
- Si falla: corregir tipos/imports hasta que el paso "Build Desktop" sea verde.

**Criterios de aceptación:**
- [ ] `npm run build --workspace=apps/desktop` pasa en máquina limpia (npm ci + build).
- [ ] El job de CI "Build Desktop" está en verde en la rama principal.

**Labels:** `sprint-1`, `ci`, `desktop`

**Archivos típicos:** `apps/desktop/src/lib/api.ts`, `apps/desktop/tsconfig.json`

---

### Issue S1-3: PWA tests verdes en CI

**Título:** `[Sprint 1] PWA tests pasando en CI (--run)`

**Descripción:**
- Asegurar que `npm run test --workspace=apps/pwa -- --run` termina con éxito. Si falla por dependencia (ej. `@testing-library/dom`), añadirla o arreglar el setup de Vitest.
- Revisar que no haya tests que dependan de entorno no disponible en CI (ej. localStorage/IndexedDB con mocks).

**Criterios de aceptación:**
- [ ] `npm run test --workspace=apps/pwa -- --run` pasa en local.
- [ ] El paso "Test PWA" en CI está en verde.

**Labels:** `sprint-1`, `ci`, `pwa`, `testing`

**Archivos típicos:** `apps/pwa/package.json`, `apps/pwa/vitest.config.ts`, `apps/pwa/src/**/*.spec.ts`

---

### Issue S1-4: Política de lint PWA y lint:ratchet

**Título:** `[Sprint 1] Definir política de lint PWA y alinear lint:ratchet`

**Descripción:**
- El roadmap indicaba ~50 errores y 20 warnings en `npm run lint --workspace=apps/pwa`. Decidir: (A) bajar a 0 errores y warnings, o (B) usar baseline temporal y documentar plan de bajada.
- Si se usa baseline: actualizar `config/ci/lint-baseline.json` o el mecanismo de `lint:ratchet` para incluir PWA donde aplique, para que CI no permita empeorar.

**Criterios de aceptación:**
- [ ] Decisión documentada (en ADR o en `docs/development/`).
- [ ] `npm run lint:ratchet` sigue pasando y, si aplica, PWA no empeora el conteo sin actualizar baseline explícitamente.

**Labels:** `sprint-1`, `ci`, `lint`, `pwa`

---

### Issue S1-5: CI único verde – checklist final

**Título:** `[Sprint 1] CI único verde para API, PWA y Desktop`

**Descripción:**
- Checklist final: tras cerrar S1-2, S1-3 y S1-4, ejecutar el pipeline completo y documentar que los tres canales (API, PWA, Desktop) tienen build + test (y lint donde aplique) en verde.
- Opcional: añadir badge en README con el estado del workflow.

**Criterios de aceptación:**
- [ ] Todos los pasos de `.github/workflows/ci.yml` pasan en `main`/`develop`.
- [ ] DoD Sprint 1 cumplido: 100% builds verdes, 0 bloqueos por script/dependencia.

**Labels:** `sprint-1`, `ci`

---

## Sprint 7 – Performance (primeras entregas)

### Issue S7-1: Medir bundle actual (react-vendor y main)

**Título:** `[Sprint 7] Medir tamaños de chunk actuales (react-vendor, main)`

**Descripción:**
- Ejecutar `npm run build --workspace=apps/pwa` y registrar tamaños (minificado) de los chunks principales, en especial `react-vendor` (o el nombre que use Vite) y el chunk de entrada.
- Documentar resultado en `docs/performance/` o en un comentario del issue S7-2 para tener baseline.

**Criterios de aceptación:**
- [ ] Documento o tabla con nombre del chunk, tamaño en KB, y fecha de medición.
- [ ] Objetivo conocido: react-vendor < 900 KB (DoD Sprint 7).

**Labels:** `sprint-7`, `performance`, `pwa`

---

### Issue S7-2: Lazy load CheckoutModal en POS (PWA)

**Título:** `[Sprint 7] Lazy load CheckoutModal en POSPage (PWA)`

**Descripción:**
- En `apps/pwa/src/pages/POSPage.tsx` (o ruta equivalente donde se use el POS), cargar `CheckoutModal` con `React.lazy()` y mostrarlo dentro de `<Suspense>` cuando el modal esté abierto.
- Evitar import estático del modal para reducir el bundle inicial del POS.

**Criterios de aceptación:**
- [ ] CheckoutModal se carga bajo demanda (lazy) al abrir el checkout.
- [ ] No hay regresión visual ni de flujo de venta.
- [ ] Build PWA sigue pasando; opcional: medir de nuevo el chunk principal y comparar con S7-1.

**Labels:** `sprint-7`, `performance`, `pwa`

**Archivos:** `apps/pwa/src/pages/POSPage.tsx`, `apps/pwa/src/components/pos/CheckoutModal.tsx` (referencia)

**Referencia:** [OPORTUNIDADES_LAZY_LOADING.md](../performance/OPORTUNIDADES_LAZY_LOADING.md) – CheckoutModal ~1916 líneas.

---

### Issue S7-3: Lazy load ProductFormModal en ProductsPage (PWA)

**Título:** `[Sprint 7] Lazy load ProductFormModal en ProductsPage (PWA)`

**Descripción:**
- En `apps/pwa/src/pages/ProductsPage.tsx`, cargar `ProductFormModal` con `React.lazy()` y `<Suspense>`, mostrándolo solo cuando el formulario de producto esté abierto.

**Criterios de aceptación:**
- [ ] ProductFormModal es lazy; el chunk se descarga al abrir el modal.
- [ ] Sin regresiones en creación/edición de productos.

**Labels:** `sprint-7`, `performance`, `pwa`

**Referencia:** [OPORTUNIDADES_LAZY_LOADING.md](../performance/OPORTUNIDADES_LAZY_LOADING.md) – ProductFormModal ~1249 líneas.

---

### Issue S7-4: Lazy load SaleDetailModal (PWA)

**Título:** `[Sprint 7] Lazy load SaleDetailModal (PWA)`

**Descripción:**
- Identificar dónde se importa `SaleDetailModal` (p. ej. lista de ventas o detalle de venta) y sustituir por `React.lazy()` + `Suspense`.

**Criterios de aceptación:**
- [ ] SaleDetailModal se carga bajo demanda.
- [ ] Flujo de consulta de venta funciona igual.

**Labels:** `sprint-7`, `performance`, `pwa`

---

### Issue S7-5: Replicar lazy load de modales en Desktop

**Título:** `[Sprint 7] Replicar lazy load de modales grandes en Desktop`

**Descripción:**
- Aplicar el mismo patrón de lazy load (CheckoutModal, ProductFormModal, SaleDetailModal) en `apps/desktop` donde existan las mismas pantallas, para mantener paridad y reducir bundle de Desktop.

**Criterios de aceptación:**
- [ ] Los mismos modales que en PWA son lazy en Desktop.
- [ ] Build Desktop sigue en verde.

**Labels:** `sprint-7`, `performance`, `desktop`

---

### Issue S7-6: Plan de chunks por ruta (documento)

**Título:** `[Sprint 7] Documentar plan de chunks por ruta/dominio`

**Descripción:**
- Redactar en `docs/performance/` un plan corto: qué rutas/dominios (POS, Inventario, Productos, Contabilidad, etc.) tienen lazy por ruta y qué componentes por ruta se cargan bajo demanda.
- Incluir lista de siguientes candidatos (p. ej. modales de Inventory, Accounting) para futuros PRs.

**Criterios de aceptación:**
- [ ] Documento con mapa de rutas y estrategia de chunking.
- [ ] Lista de siguientes tareas de lazy load priorizada.

**Labels:** `sprint-7`, `performance`, `docs`

---

### Issue S7-7: Objetivo react-vendor < 900 KB y medición TTI

**Título:** `[Sprint 7] Cumplir react-vendor < 900 KB y medir TTI`

**Descripción:**
- Tras S7-2 a S7-5 (y más lazy si hace falta), verificar que el chunk `react-vendor` (o equivalente) está por debajo de 900 KB minificado.
- Medir TTI (Time to Interactive) en dispositivo medio (Lighthouse o WebPageTest) y documentar; objetivo DoD: TTI < 2.5s.

**Criterios de aceptación:**
- [ ] react-vendor < 900 KB en build de producción PWA.
- [ ] TTI medido y documentado; si está por encima de 2.5s, dejar tareas de seguimiento documentadas.

**Labels:** `sprint-7`, `performance`, `pwa`

---

## Orden sugerido de implementación

**Sprint 1 (primero):** S1-2 → S1-3 → S1-4 → S1-1 → S1-5.  
**Sprint 7 (después):** S7-1 → S7-2 → S7-3 → S7-4 → S7-5 → S7-6 → S7-7.

---

## Cómo usar este documento

1. **GitHub:** Crear un issue por cada bloque (título = Título del issue, body = Descripción + Criterios de aceptación), y usar Labels si existen en el repo.
2. **Tablero:** Crear tarjetas con el título y en la descripción pegar Descripción + Criterios.
3. **PRs:** Cada issue puede cerrarse con uno o dos PRs; en la descripción del PR referenciar el issue (ej. `Closes #XX (S1-2)`).

Si quieres, el siguiente paso puede ser generar los mismos issues para Sprint 5.3–5.5 o para la base de Sprint 6 (offline + conflictos).
