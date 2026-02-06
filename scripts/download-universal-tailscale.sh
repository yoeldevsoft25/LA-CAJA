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

download_tailscale() {
  local ARCH=$1       # amd64 o arm64
  local TARGET=$2     # x86_64-apple-darwin o aarch64-apple-darwin

  local URL="https://pkgs.tailscale.com/stable/tailscale_${VERSION}_${ARCH}.tgz"
  local FILE="tailscale_${ARCH}.tgz"

  echo "Descargando Tailscale para $TARGET ($ARCH)..."
  curl -fsSL "$URL" -o "$FILE"

  tar -xzf "$FILE"

  local FOLDER
  FOLDER=$(ls -d tailscale_*_"$ARCH" | head -n 1)

  if [[ -d "$FOLDER" ]]; then
    echo "Copiando binarios para $TARGET..."
    cp "$FOLDER/tailscaled" "$BIN_DIR/tailscaled-$TARGET"
    cp "$FOLDER/tailscale" "$BIN_DIR/tailscale-$TARGET"
    chmod +x "$BIN_DIR/tailscaled-$TARGET" "$BIN_DIR/tailscale-$TARGET"
    rm -rf "$FOLDER"
  else
    echo "Error: No se encontró la carpeta extraída para $ARCH"
    ls -ld tailscale_*
    exit 1
  fi

  rm "$FILE"
}

ensure_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "La herramienta $1 no está instalada; instálala para continuar."
    exit 1
  fi
}

ensure_tool lipo

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
