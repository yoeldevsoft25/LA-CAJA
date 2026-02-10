#!/bin/bash

# Script para descargar y preparar los binarios de Tailscale utilizados como sidecar en macOS.
# Descarga las variantes x86_64 y arm64, los pega en `apps/desktop/src-tauri/binaries` y genera
# los binarios universales requeridos por `tauri build --target universal-apple-darwin`.

set -euo pipefail

BIN_DIR="apps/desktop/src-tauri/binaries"
VERSION="latest"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este script solo se ejecuta en macOS."
  exit 0
fi

mkdir -p "$BIN_DIR"

if [[ -f "$BIN_DIR/tailscale-universal-apple-darwin" ]] && [[ -f "$BIN_DIR/tailscaled-universal-apple-darwin" ]]; then
  echo "Los binarios universales ya existen, no se requiere acción adicional."
  exit 0
fi

ensure_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "La herramienta $1 no está instalada; instálala para continuar."
    exit 1
  fi
}

ensure_tool lipo
ensure_tool python3
ensure_tool file

fetch_release_json() {
  # We intentionally use GitHub releases for macOS. The pkgs.tailscale.com tarballs are Linux ELF,
  # which makes `lipo` fail when creating a universal Mach-O binary.
  local api
  if [[ "$VERSION" == "latest" ]]; then
    api="https://api.github.com/repos/tailscale/tailscale/releases/latest"
  else
    # Accept VERSION with or without leading "v"
    local tag="$VERSION"
    if [[ "$tag" != v* ]]; then
      tag="v${tag}"
    fi
    api="https://api.github.com/repos/tailscale/tailscale/releases/tags/${tag}"
  fi

  # Avoid GitHub API rate limiting when running locally by allowing a token.
  # In GitHub Actions, this isn't strictly required, but it also works there.
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "X-GitHub-Api-Version: 2022-11-28" "$api"
  else
    curl -fsSL -H "X-GitHub-Api-Version: 2022-11-28" "$api"
  fi
}

pick_asset_url() {
  local release_json="$1"
  local arch="$2" # amd64 | arm64

  # Match both old/new naming variants just in case.
  # Examples we try to match:
  # - tailscale_*_darwin_amd64.tgz
  # - tailscale_*_darwin_arm64.tgz
  # - tailscale_*_darwin_x86_64.tgz
  # - tailscale_*_darwin_aarch64.tgz
  # NOTE: We must not feed the JSON into stdin because `python3 -` reads the script from stdin.
  # If JSON is passed via stdin, Python will try to execute it and fail on tokens like `false`.
  local json_file
  json_file="$(mktemp)"
  trap 'rm -f "$json_file"' RETURN
  printf '%s' "$release_json" >"$json_file"

  python3 - "$arch" "$json_file" <<'PY'
import json, re, sys

arch = sys.argv[1]
path = sys.argv[2]
with open(path, "r", encoding="utf-8") as f:
  data = json.load(f)
assets = data.get("assets", [])

patterns = []
if arch == "amd64":
  patterns = [
    re.compile(r"^tailscale_.*_darwin_amd64\.tgz$"),
    re.compile(r"^tailscale_.*_darwin_x86_64\.tgz$"),
  ]
elif arch == "arm64":
  patterns = [
    re.compile(r"^tailscale_.*_darwin_arm64\.tgz$"),
    re.compile(r"^tailscale_.*_darwin_aarch64\.tgz$"),
  ]
else:
  raise SystemExit(f"Unknown arch: {arch}")

for a in assets:
  name = a.get("name", "")
  for p in patterns:
    if p.match(name):
      url = a.get("browser_download_url")
      if url:
        print(url)
        raise SystemExit(0)

available = ", ".join([a.get("name", "") for a in assets])
raise SystemExit(f"No matching darwin asset for arch={arch}. Available: {available}")
PY
}

assert_macho() {
  local path="$1"
  local desc
  desc="$(file "$path" || true)"
  if ! echo "$desc" | grep -q "Mach-O"; then
    echo "Error: Se esperaba un binario Mach-O para macOS, pero obtuvimos:"
    echo "  $desc"
    echo "Ruta: $path"
    exit 1
  fi
}

download_tailscale() {
  local ARCH=$1       # amd64 o arm64
  local TARGET=$2     # x86_64-apple-darwin o aarch64-apple-darwin

  local release_json url file
  release_json="$(fetch_release_json)"
  url="$(pick_asset_url "$release_json" "$ARCH")"
  file="tailscale_${TARGET}.tgz"

  echo "Descargando Tailscale para $TARGET ($ARCH)..."
  curl -fsSL "$url" -o "$file"

  tar -xzf "$file"

  local FOLDER
  # GitHub release tarballs usually extract into `tailscale_<version>_darwin_<arch>`
  FOLDER=$(ls -d "tailscale_"*_darwin_"$ARCH"* 2>/dev/null | head -n 1 || true)

  if [[ -d "$FOLDER" ]]; then
    echo "Copiando binarios para $TARGET..."
    cp "$FOLDER/tailscaled" "$BIN_DIR/tailscaled-$TARGET"
    cp "$FOLDER/tailscale" "$BIN_DIR/tailscale-$TARGET"
    chmod +x "$BIN_DIR/tailscaled-$TARGET" "$BIN_DIR/tailscale-$TARGET"
    assert_macho "$BIN_DIR/tailscaled-$TARGET"
    assert_macho "$BIN_DIR/tailscale-$TARGET"
    rm -rf "$FOLDER"
  else
    echo "Error: No se encontró la carpeta extraída para $ARCH"
    ls -ld tailscale_* || true
    exit 1
  fi

  rm "$file"
}

download_tailscale "amd64" "x86_64-apple-darwin"
download_tailscale "arm64" "aarch64-apple-darwin"

combine_universal() {
  local output=$1
  shift
  echo "Creando binario universal $output..."
  lipo -create "${BIN_DIR}/tailscaled-x86_64-apple-darwin" "${BIN_DIR}/tailscaled-aarch64-apple-darwin" -output "${BIN_DIR}/${output}"
  chmod +x "${BIN_DIR}/${output}"
}

combine_universal "tailscaled-universal-apple-darwin"

combine_cli_universal() {
  local output=$1
  echo "Creando binario universal $output..."
  lipo -create "${BIN_DIR}/tailscale-x86_64-apple-darwin" "${BIN_DIR}/tailscale-aarch64-apple-darwin" -output "${BIN_DIR}/${output}"
  chmod +x "${BIN_DIR}/${output}"
}

combine_cli_universal "tailscale-universal-apple-darwin"

echo "----------------------------------------------------------"
echo "Contenido de $BIN_DIR:"
ls -lh "$BIN_DIR"
echo "----------------------------------------------------------"
echo "Binarios universales listos para el build de macOS."
