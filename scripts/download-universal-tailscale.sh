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
ensure_tool unzip

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

download_macos_universal_from_pkgs() {
  # pkgs.tailscale.com/stable provides a macOS app zip/pkg, not per-arch CLI tarballs.
  # We download the .zip and extract `tailscale` and `tailscaled` from inside the app bundle.
  local base="https://pkgs.tailscale.com/stable"
  local html zip_name url tmp

  echo "Detectando versión macOS desde $base/ ..."
  html="$(curl -fsSL "${base}/")"
  # The stable page lists versioned macOS artifacts like:
  # - Tailscale-1.94.1-macos.zip
  # - Tailscale-1.94.1-macos.pkg
  #
  # Use a single backslash (within single quotes) to escape the dot.
  zip_name="$(echo "$html" | grep -oE 'Tailscale-[0-9.]+-macos\.zip' | head -n 1 || true)"
  if [[ -z "$zip_name" ]]; then
    echo "Error: No se pudo detectar el zip de macOS en ${base}/"
    exit 1
  fi

  url="${base}/${zip_name}"
  echo "Descargando Tailscale macOS: $zip_name"

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  curl -fsSL "$url" -o "${tmp}/${zip_name}"
  unzip -q "${tmp}/${zip_name}" -d "${tmp}/unzipped"

  # Find tailscaled/tailscale binaries within the extracted app.
  local tailscaled_path tailscale_path
  # Zip extraction may not preserve executable bits, so do not filter by -perm.
  tailscaled_path="$(find "${tmp}/unzipped" -type f -name "tailscaled" 2>/dev/null | head -n 1 || true)"
  tailscale_path="$(find "${tmp}/unzipped" -type f -name "tailscale" 2>/dev/null | head -n 1 || true)"

  if [[ -z "$tailscaled_path" || -z "$tailscale_path" ]]; then
    echo "Error: No se encontraron binarios 'tailscaled'/'tailscale' dentro del zip."
    echo "Dump (primeros matches):"
    find "${tmp}/unzipped" -maxdepth 6 -type f -name "*tail*" 2>/dev/null | head -n 50 || true
    exit 1
  fi

  echo "Validando binarios universales..."
  assert_universal_macho "$tailscaled_path"
  assert_universal_macho "$tailscale_path"

  echo "Copiando binarios universales a $BIN_DIR..."
  cp "$tailscaled_path" "$BIN_DIR/tailscaled-universal-apple-darwin"
  cp "$tailscale_path" "$BIN_DIR/tailscale-universal-apple-darwin"
  chmod +x "$BIN_DIR/tailscaled-universal-apple-darwin" "$BIN_DIR/tailscale-universal-apple-darwin"

  # Compatibility: some tooling expects per-target filenames.
  cp "$BIN_DIR/tailscaled-universal-apple-darwin" "$BIN_DIR/tailscaled-x86_64-apple-darwin"
  cp "$BIN_DIR/tailscaled-universal-apple-darwin" "$BIN_DIR/tailscaled-aarch64-apple-darwin"
  cp "$BIN_DIR/tailscale-universal-apple-darwin" "$BIN_DIR/tailscale-x86_64-apple-darwin"
  cp "$BIN_DIR/tailscale-universal-apple-darwin" "$BIN_DIR/tailscale-aarch64-apple-darwin"
}

download_macos_universal_from_pkgs

echo "----------------------------------------------------------"
echo "Contenido de $BIN_DIR:"
ls -lh "$BIN_DIR"
echo "----------------------------------------------------------"
echo "Binarios universales listos para el build de macOS."
