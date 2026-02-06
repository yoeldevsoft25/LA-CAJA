# Política de Lint y baseline (Sprint 1)

**Objetivo:** No empeorar la calidad de lint en el repo. El CI usa un *ratchet*: si los conteos de errores o warnings superan el baseline, el pipeline falla.  
**Relacionado:** [config/ci/lint-baseline.json](../../config/ci/lint-baseline.json), [scripts/ci/lint-ratchet.mjs](../../scripts/ci/lint-ratchet.mjs).

---

## Cómo funciona

- **`npm run lint:ratchet`** (en CI y en local) ejecuta ESLint sobre los targets definidos en `config/ci/lint-baseline.json`.
- Cada target tiene un **máximo de errores** y un **máximo de warnings**.
- Si en algún target los conteos actuales son **mayores** que el baseline, el comando termina con código 1 (regresión).

Targets actuales:

| Target   | CWD        | Patrones              | maxErrors | maxWarnings |
|----------|------------|------------------------|-----------|-------------|
| api      | apps/api   | src/**/*.ts           | 3254      | 0           |
| pwa      | apps/pwa   | src/**/*.{ts,tsx}     | 45        | 20          |
| desktop  | apps/desktop | src/**/*.{ts,tsx}   | 45        | 20          |

---

## Regla de oro

**No subas cambios que aumenten el número de errores o de warnings** sin:

1. Corregir el lint en el mismo PR (nuevo código sin errores/warnings), **o**
2. Actualizar el baseline de forma **explícita y documentada** (ej. en el mensaje del commit o en el PR: "Actualizo baseline PWA por refactor X; plan de bajada en issue #Y").

---

## Cómo ver los conteos actuales

Desde la raíz:

```bash
# API
npm run lint --workspace=apps/api

# PWA
npm run lint --workspace=apps/pwa

# Desktop
npm run lint --workspace=apps/desktop
```

Al final, ESLint imprime el resumen (errores/warnings). Compara con `config/ci/lint-baseline.json`.

---

## Cómo actualizar el baseline (excepcional)

Solo cuando el equipo acepte **temporalmente** más errores o warnings (por ejemplo, refactor grande en varias PRs):

1. Ejecuta lint en el workspace correspondiente y anota los **conteos totales** (errors, warnings).
2. Edita `config/ci/lint-baseline.json` y actualiza `maxErrors` y/o `maxWarnings` del target (api, pwa o desktop) a esos valores (o ligeramente por encima si vas a arreglar en el mismo PR).
3. Documenta en el commit o en el PR: "Actualizo baseline PWA: 45→50 errors por [motivo]. Plan: issue #Z para bajar a 0."

Así el ratchet sigue evitando que alguien empeore sin darse cuenta; el baseline solo se mueve hacia atrás de forma consciente.

---

## Objetivo a medio plazo

- **API:** ir bajando el baseline (3254) en sprints de limpieza, sin bloquear features.
- **PWA y Desktop:** mantener o bajar 45/20; no subir sin acuerdo.

Si en tu PR corriges archivos que ya tenían lint, puedes **bajar** el conteo; en ese caso no hace falta tocar el baseline (el ratchet permite menos errores/warnings).

---

## Resumen

1. **lint:ratchet** = no empeorar respecto a `config/ci/lint-baseline.json`.  
2. Para no romper CI: no añadas errores ni warnings; o actualiza el baseline y documéntalo.  
3. Ver conteos con `npm run lint --workspace=apps/<api|pwa|desktop>`.
