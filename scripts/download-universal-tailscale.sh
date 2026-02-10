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
ensure_tool file
ensure_tool go

detect_stable_version() {
  local base="https://pkgs.tailscale.com/stable"
  local html version
  echo "Detectando versión Tailscale desde ${base}/ ..."
  html="$(curl -fsSL "${base}/")"

  # Prefer the macOS artifact version if present.
  version="$(echo "$html" | grep -oE 'Tailscale-([0-9.]+)-macos\.(zip|pkg)' | head -n 1 | sed -E 's/^Tailscale-([0-9.]+)-macos\.(zip|pkg)$/\1/' || true)"
  if [[ -z "$version" ]]; then
    # Fallback to static tarball version (same release train).
    version="$(echo "$html" | grep -oE 'tailscale_([0-9.]+)_amd64\.tgz' | head -n 1 | sed -E 's/^tailscale_([0-9.]+)_amd64\.tgz$/\1/' || true)"
  fi

  if [[ -z "$version" ]]; then
    echo "Error: No se pudo detectar la versión desde ${base}/"
    exit 1
  fi

  echo "$version"
}

assert_universal_macho() {
  local path="$1"
  local desc info
  desc="$(file "$path" || true)"
  if ! echo "$desc" | grep -q "Mach-O"; then
    echo "Error: Se esperaba un binario Mach-O para macOS, pero obtuvimos:"
    echo "  $desc"
    echo "Ruta: $path"
    exit 1
  fi
  info="$(lipo -info "$path" 2>/dev/null || true)"
  if ! echo "$info" | grep -Eq "(arm64|arm64e)" || ! echo "$info" | grep -q "x86_64"; then
    echo "Error: Se esperaba un binario universal (arm64 + x86_64). lipo -info devolvió:"
    echo "  $info"
    echo "Ruta: $path"
    exit 1
  fi
}

build_universal_with_go() {
  local version="$1" # e.g. 1.94.1
  local tag="v${version}"

  echo "Compilando tailscale/tailscaled desde Go modules ($tag) para macOS universal..."

  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  # Build tailscaled for both architectures.
  GOBIN="${tmp}/amd64" GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go install "tailscale.com/cmd/tailscaled@${tag}"
  GOBIN="${tmp}/arm64" GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go install "tailscale.com/cmd/tailscaled@${tag}"

  # Build tailscale CLI for both architectures.
  GOBIN="${tmp}/amd64" GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go install "tailscale.com/cmd/tailscale@${tag}"
  GOBIN="${tmp}/arm64" GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go install "tailscale.com/cmd/tailscale@${tag}"

  # Combine into universal Mach-O.
  lipo -create "${tmp}/amd64/tailscaled" "${tmp}/arm64/tailscaled" -output "${BIN_DIR}/tailscaled-universal-apple-darwin"
  lipo -create "${tmp}/amd64/tailscale" "${tmp}/arm64/tailscale" -output "${BIN_DIR}/tailscale-universal-apple-darwin"
  chmod +x "${BIN_DIR}/tailscaled-universal-apple-darwin" "${BIN_DIR}/tailscale-universal-apple-darwin"

  # Sanity check.
  assert_universal_macho "${BIN_DIR}/tailscaled-universal-apple-darwin"
  assert_universal_macho "${BIN_DIR}/tailscale-universal-apple-darwin"

  # Compatibility: some tooling expects per-target filenames.
  cp "${BIN_DIR}/tailscaled-universal-apple-darwin" "${BIN_DIR}/tailscaled-x86_64-apple-darwin"
  cp "${BIN_DIR}/tailscaled-universal-apple-darwin" "${BIN_DIR}/tailscaled-aarch64-apple-darwin"
  cp "${BIN_DIR}/tailscale-universal-apple-darwin" "${BIN_DIR}/tailscale-x86_64-apple-darwin"
  cp "${BIN_DIR}/tailscale-universal-apple-darwin" "${BIN_DIR}/tailscale-aarch64-apple-darwin"
}

ts_version="$(detect_stable_version)"
build_universal_with_go "$ts_version"

echo "----------------------------------------------------------"
echo "Contenido de $BIN_DIR:"
ls -lh "$BIN_DIR"
echo "----------------------------------------------------------"
echo "Binarios universales listos para el build de macOS."
