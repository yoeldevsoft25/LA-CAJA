#!/bin/bash

# Script para descargar y configurar el sidecar de Tailscale en LA-CAJA
# Uso: ./scripts/download-tailscale-sidecar.sh

BIN_DIR="apps/desktop/src-tauri/binaries"
TARGET_TRIPLE=$(rustc --print host-tuple)
VERSION="1.58.2" # O la última versión estable

echo "Detectando plataforma: $TARGET_TRIPLE"
mkdir -p "$BIN_DIR"

if [[ "$TARGET_TRIPLE" == *"apple-darwin"* ]]; then
    ARCH="amd64"
    if [[ "$TARGET_TRIPLE" == "aarch64-apple-darwin" ]]; then ARCH="arm64"; fi
    
    URL="https://pkgs.tailscale.com/stable/tailscale_latest_${ARCH}.tgz"
    FILE="tailscale.tgz"
    echo "Descargando Tailscale para macOS ($ARCH)..."
    curl -L "$URL" -o "$FILE"
    
    # Extraer y buscar el binario tailscaled y tailscale
    tar -xzf "$FILE"
    # El contenido del tgz es una carpeta como tailscale_1.x.y_amd64/
    FOLDER=$(ls -d tailscale_*_${ARCH})
    cp "$FOLDER/tailscaled" "$BIN_DIR/tailscaled-$TARGET_TRIPLE"
    cp "$FOLDER/tailscale" "$BIN_DIR/tailscale-$TARGET_TRIPLE"
    
    rm -rf "$FOLDER" "$FILE"
elif [[ "$TARGET_TRIPLE" == *"pc-windows-msvc"* ]]; then
    # Para Windows, los binarios se obtienen del MSI oficial.
    URL_MSI="https://pkgs.tailscale.com/stable/tailscale-setup-amd64.msi"
    echo "----------------------------------------------------------"
    echo "PARA WINDOWS ($TARGET_TRIPLE):"
    echo "1. Descarga el MSI: $URL_MSI"
    echo "2. Instálalo o extráelo en una PC."
    echo "3. Copia 'tailscale.exe' y 'tailscaled.exe' a:"
    echo "   $BIN_DIR/tailscale-$TARGET_TRIPLE.exe"
    echo "   $BIN_DIR/tailscaled-$TARGET_TRIPLE.exe"
    echo "----------------------------------------------------------"
else
    echo "Plataforma no soportada automáticamente."
fi

# Configurar permisos en POSIX
if [ -f "$BIN_DIR/tailscaled-$TARGET_TRIPLE" ]; then
    chmod +x "$BIN_DIR/tailscaled-$TARGET_TRIPLE"
    chmod +x "$BIN_DIR/tailscale-$TARGET_TRIPLE"
    echo "Sidecars de macOS listos en $BIN_DIR"
fi
