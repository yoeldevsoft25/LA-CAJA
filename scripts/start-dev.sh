#!/bin/bash

# Script de inicio para desarrollo - Mac/Linux
# Inicia el backend API y la PWA en paralelo

echo "🚀 Iniciando LA CAJA..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json"
    echo "   Asegúrate de estar en el directorio raíz del proyecto"
    exit 1
fi

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    echo "   Instala Node.js desde https://nodejs.org/ o con: brew install node"
    exit 1
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm no está instalado"
    exit 1
fi

# Verificar que las dependencias estén instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

echo "✅ Iniciando servicios..."
echo ""

# Función para limpiar procesos al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $API_PID $PWA_PID 2>/dev/null
    exit 0
}

# Capturar Ctrl+C
trap cleanup INT TERM

# Iniciar API en background
echo "🔧 Iniciando Backend API..."
npm run dev:api > /tmp/la-caja-api.log 2>&1 &
API_PID=$!

# Esperar un poco para que la API inicie
sleep 3

# Iniciar PWA en background
echo "🌐 Iniciando PWA Frontend..."
npm run dev:pwa > /tmp/la-caja-pwa.log 2>&1 &
PWA_PID=$!

# Esperar un poco más
sleep 2

echo ""
echo "✅ Servicios iniciados:"
echo "   📡 Backend API: http://localhost:3000 (PID: $API_PID)"
echo "   🖥️  PWA Frontend: http://localhost:5173 (PID: $PWA_PID)"
echo ""
echo "📋 Logs:"
echo "   - API: tail -f /tmp/la-caja-api.log"
echo "   - PWA: tail -f /tmp/la-caja-pwa.log"
echo ""
echo "⚠️  Presiona Ctrl+C para detener todos los servicios"
echo ""

# Esperar a que el usuario presione Ctrl+C
wait

