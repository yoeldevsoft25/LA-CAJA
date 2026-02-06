#!/usr/bin/env bash
# Verificación mínima del entorno local (Sprint 1).
# Uso: desde la raíz del repo, ejecutar ./scripts/check-env.sh
# No requiere node_modules instalados.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[check-env] Repo root: $REPO_ROOT"

# 1. Node presente y versión
if ! command -v node >/dev/null 2>&1; then
  echo "[check-env] ERROR: Node.js no encontrado. Instala Node 20 (recomendado: nvm install)"
  exit 1
fi
NODE_VER=$(node -v)
echo "[check-env] Node: $NODE_VER"

# 2. Comparar con .nvmrc si existe
if [[ -f .nvmrc ]]; then
  WANT=$(cat .nvmrc | tr -d '[:space:]')
  # Comparar solo major (v20 vs 20.19.0)
  NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
  WANT_MAJOR="${WANT%%.*}"
  if [[ "$NODE_MAJOR" != "$WANT_MAJOR" ]]; then
    echo "[check-env] AVISO: .nvmrc pide Node $WANT (major $WANT_MAJOR); tienes major $NODE_MAJOR. Recomendado: nvm use"
  else
    echo "[check-env] Node major coincide con .nvmrc ($WANT_MAJOR)"
  fi
fi

# 3. npm
if ! command -v npm >/dev/null 2>&1; then
  echo "[check-env] ERROR: npm no encontrado."
  exit 1
fi
NPM_VER=$(npm -v)
echo "[check-env] npm: $NPM_VER"

# 4. node_modules (opcional; no fallar)
if [[ ! -d node_modules ]]; then
  echo "[check-env] AVISO: node_modules no existe. Ejecuta 'npm ci' desde la raíz."
else
  echo "[check-env] node_modules: OK"
fi

echo "[check-env] Entorno listo. Siguiente: npm ci && npm run build:packages"
