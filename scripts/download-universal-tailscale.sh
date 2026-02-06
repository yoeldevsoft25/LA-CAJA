#!/bin/bash

# Script para descargar binarios de Tailscale para arquitecturas universales (x86_64 y aarch64) en macOS.
# Esto es necesario para que `tauri build --target universal-apple-darwin` funcione correctamente.

BIN_DIR="apps/desktop/src-tauri/binaries"
VERSION="latest"

echo "Preparando directorio de binarios: $BIN_DIR"
mkdir -p "$BIN_DIR"

download_tailscale() {
    local ARCH=$1       # amd64 o arm64
    local TARGET=$2     # x86_64-apple-darwin o aarch64-apple-darwin
    
    local URL="https://pkgs.tailscale.com/stable/tailscale_${VERSION}_${ARCH}.tgz"
    local FILE="tailscale_${ARCH}.tgz"
    
    echo "Descargando Tailscale para $TARGET ($ARCH)..."
    curl -L "$URL" -o "$FILE"
    
    if [ ! -f "$FILE" ]; then
        echo "Error: No se pudo descargar $URL"
        return 1
    fi

    # Extraer
    tar -xzf "$FILE"
    
    # El contenido es una carpeta como tailscale_1.x.y_amd64/
    local FOLDER=$(ls -d tailscale_*_${ARCH} | head -n 1)
    
    if [ -d "$FOLDER" ]; then
        echo "Copiando binarios para $TARGET..."
        cp "$FOLDER/tailscaled" "$BIN_DIR/tailscaled-$TARGET"
        cp "$FOLDER/tailscale" "$BIN_DIR/tailscale-$TARGET"
        chmod +x "$BIN_DIR/tailscaled-$TARGET"
        chmod +x "$BIN_DIR/tailscale-$TARGET"
        
        rm -rf "$FOLDER"
    else
        echo "Error: No se encontró la carpeta extraída para $ARCH"
    fi
    
    rm "$FILE"
}

# Descargar ambas arquitecturas para macOS
download_tailscale "amd64" "x86_64-apple-darwin"
download_tailscale "arm64" "aarch64-apple-darwin"

echo "----------------------------------------------------------"
echo "Contenido de $BIN_DIR:"
ls -lh "$BIN_DIR"
echo "----------------------------------------------------------"
echo "Binarios listos para build universal de macOS."
echo ""
echo "NOTA PARA WINDOWS:"
echo "Los binarios de Windows (x86_64-pc-windows-msvc) no se descargan automáticamente."
echo "Por favor, descarga el MSI oficial, extrae 'tailscale.exe' y 'tailscaled.exe' y colócalos en:"
echo "  $BIN_DIR/tailscale-x86_64-pc-windows-msvc.exe"
echo "  $BIN_DIR/tailscaled-x86_64-pc-windows-msvc.exe"
