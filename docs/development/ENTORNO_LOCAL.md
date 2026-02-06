# Entorno local – Requisitos y verificación

**Objetivo:** Que cualquier desarrollador pueda clonar el repo y arrancar API, PWA y Desktop sin pasos implícitos.  
**Sprint:** 1 (Estabilización).  
**Relacionado:** [INSTALL.md](./INSTALL.md), [ZONAS_NO_TERMINADAS_TAREAS.md](../roadmap/ZONAS_NO_TERMINADAS_TAREAS.md).

---

## Requisitos obligatorios

| Herramienta | Versión mínima | Comprobación |
|-------------|----------------|--------------|
| **Node.js** | 20.x (recomendado; el repo usa `.nvmrc` con 20.19.0) | `node -v` |
| **npm** | 9.x (viene con Node 20) | `npm -v` |
| **Git** | Cualquier versión reciente | `git --version` |

Opcional según lo que vayas a ejecutar:

- **PostgreSQL** o **Supabase**: para el backend (API).
- **Rust + Tauri**: solo si vas a construir o ejecutar Desktop (`npm run dev:desktop` / `build --workspace=apps/desktop`). Ver [INSTALL.md](./INSTALL.md) para Rust en Windows.

---

## Comprobar entorno antes de trabajar

Desde la raíz del repositorio:

```bash
# Verificar que Node cumple .nvmrc (recomendado)
./scripts/check-env.sh

# O manualmente:
node -v   # Debería ser v20.x
npm -v    # >= 9
```

Si usas **nvm**:

```bash
nvm install    # Lee .nvmrc e instala la versión
nvm use        # Activa esa versión
```

---

## Instalación de dependencias (siempre desde la raíz)

```bash
npm ci
```

Usa `npm ci` (no `npm install`) para tener un árbol de dependencias reproducible y alineado con CI.  
Después de clonar o después de pull que toque `package-lock.json`, vuelve a ejecutar `npm ci`.

---

## Variables de entorno opcionales

No son obligatorias para desarrollo local por defecto.

| Variable | Dónde | Uso |
|----------|--------|-----|
| `VITE_PRIMARY_API_URL` | PWA / Desktop | URL del API en dev (ej. `http://localhost:3000`). Por defecto se infiere localhost. |
| `VITE_FALLBACK_API_URL` | PWA / Desktop | URL de respaldo (ej. backend en Render). |
| `DATABASE_URL`, `JWT_SECRET`, etc. | API | Ver `apps/api/.env.example`. |

Para Desktop con Tailscale/túnel interno, ver documentación de deployment y `apps/desktop/.env`.

---

## Arrancar en desarrollo (3 terminales)

Desde la **raíz** del repo:

```bash
# Terminal 1 – Backend
npm run dev:api

# Terminal 2 – PWA
npm run dev:pwa

# Terminal 3 – Desktop (opcional; requiere Rust/Tauri)
npm run dev:desktop
```

Comprobación rápida:

- API: http://localhost:3000/health  
- PWA: http://localhost:5173  
- Desktop: se abre la ventana de Tauri.

---

## Verificar builds (mismo orden que CI)

Para asegurarte de que no rompes el pipeline, ejecuta en la raíz:

```bash
npm run build:packages
npm run build --workspace=apps/api
npm run build --workspace=apps/pwa
npm run build --workspace=apps/desktop
```

Tests:

```bash
npm run test --workspace=apps/api -- --runInBand
npm run test --workspace=apps/pwa -- --run
npm run test:run --workspace=apps/desktop
```

Lint (no empeorar respecto al baseline):

```bash
npm run lint:ratchet
```

Si algún paso falla, ver [ISSUES_PR_SPRINT_1_Y_7.md](../roadmap/ISSUES_PR_SPRINT_1_Y_7.md) (Sprint 1) antes de tocar código compartido.

---

## Problemas frecuentes

- **`tsc: command not found`** o **`nest: command not found`**  
  Ejecuta `npm ci` desde la raíz; los binarios están en `node_modules/.bin`. Si usas IDE, abre la raíz del monorepo como workspace.

- **Build Desktop falla por tipado**  
  Revisar `apps/desktop/src/lib/api.ts` y `tsconfig.json`. El roadmap histórico mencionaba línea 270; el archivo puede haber cambiado de tamaño.

- **PWA tests fallan por `@testing-library/dom`**  
  La dependencia está en `apps/pwa/package.json`. Si falla en CI, asegúrate de que `npm ci` se ejecutó y que no hay conflicto de versiones con `jsdom` en Vitest.

- **Lint falla en PWA/Desktop**  
  El baseline está en `config/ci/lint-baseline.json`. No subas cambios que aumenten errores/warnings sin actualizar el baseline a propósito. Ver [POLITICA_LINT.md](./POLITICA_LINT.md).

---

## Resumen

1. Node 20, `npm ci`, tres comandos `dev:*`.  
2. Usa `scripts/check-env.sh` para comprobar Node y, opcionalmente, existencia de `node_modules`.  
3. Antes de push, ejecuta builds y tests como en CI para no introducir regresiones.
