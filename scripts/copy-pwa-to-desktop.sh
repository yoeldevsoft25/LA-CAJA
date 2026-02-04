#!/bin/bash

# Script para copiar archivos de PWA a Desktop (Mac/Linux)

pwaSrc="apps/pwa/src"
desktopSrc="apps/desktop/src"

dirs=("pages" "components" "services" "stores" "lib" "db" "utils")

echo ""
echo -e "\033[0;36mCopiando archivos de PWA a Desktop...\033[0m"
echo ""

for dir in "${dirs[@]}"; do
    src="$pwaSrc/$dir"
    dst="$desktopSrc/$dir"
    
    if [ -d "$src" ]; then
        echo -e "\033[0;33mCopiando $dir...\033[0m"
        
        # Eliminar destino si existe
        if [ -d "$dst" ]; then
            rm -rf "$dst"
        fi
        
        # Copiar directorio
        cp -R "$src" "$dst"
        echo -e "\033[0;32m  $dir copiado exitosamente\033[0m"
    else
        echo -e "\033[0;33m  $dir no existe en PWA\033[0m"
    fi
done

echo ""
echo -e "\033[0;32mProceso completado!\033[0m"
echo ""
echo -e "\033[0;36mSiguiente paso: cd apps/desktop && npm install\033[0m"
