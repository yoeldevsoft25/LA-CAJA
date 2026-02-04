#!/bin/bash

# Improved script for FULL synchronization of PWA to Desktop (Mac/Linux)

pwaSrcRoot="apps/pwa/src"
desktopSrcRoot="apps/desktop/src"

echo ""
echo -e "\033[0;36mIniciando sincronización TOTAL de PWA a Desktop...\033[0m"
echo ""

if [ ! -d "$pwaSrcRoot" ]; then
    echo -e "\033[0;31mError: $pwaSrcRoot no existe.\033[0m"
    exit 1
fi

# Copiar todo el contenido de src de PWA a Desktop
# Usamos -a para preservar atributos y -v para ver progreso
# Excluimos archivos que podrían ser específicos de cada plataforma si fuera necesario
# Pero por ahora queremos paridad total excepto por la configuración de Vite/Tauri que está fuera de src

cp -av "$pwaSrcRoot/"* "$desktopSrcRoot/"

echo ""
echo -e "\033[0;32m¡Sincronización TOTAL completada con éxito!\033[0m"
echo ""
echo -e "\033[0;36mNota: Se han sincronizado todas las carpetas (hooks, types, services, pages, components, etc.)\033[0m"
echo ""
