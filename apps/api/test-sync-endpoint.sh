#!/bin/bash

# =====================================================
# Script de prueba del endpoint /sync/push
# =====================================================

set -e

echo "🧪 Probando endpoint /sync/push con Vector Clocks..."
echo ""

# IMPORTANTE: Necesitas un JWT válido
# Obtén uno desde tu app o genera uno temporalmente
echo "⚠️  IMPORTANTE: Necesitas configurar un JWT válido"
echo "Editá este script y reemplazá 'YOUR_JWT_TOKEN' con un token real"
echo ""

# URL del backend (ajusta si es diferente)
API_URL="http://localhost:3000"
JWT_TOKEN="YOUR_JWT_TOKEN"  # ← REEMPLAZAR AQUÍ

if [ "$JWT_TOKEN" = "YOUR_JWT_TOKEN" ]; then
  echo "❌ Error: JWT_TOKEN no configurado"
  echo "   Editá este script y configurá un JWT válido"
  exit 1
fi

echo "📡 Enviando evento de prueba..."
echo ""

# Evento de prueba con vector clock
RESPONSE=$(curl -s -X POST "$API_URL/sync/push" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "store_id": "550e8400-e29b-41d4-a716-446655440000",
    "device_id": "550e8400-e29b-41d4-a716-446655440001",
    "client_version": "1.0.0",
    "events": [
      {
        "event_id": "550e8400-e29b-41d4-a716-446655440002",
        "seq": 1,
        "type": "ProductCreated",
        "version": 1,
        "created_at": 1704067200000,
        "actor": {
          "user_id": "550e8400-e29b-41d4-a716-446655440003",
          "role": "owner"
        },
        "payload": {
          "product_id": "550e8400-e29b-41d4-a716-446655440004",
          "name": "Coca Cola 1L - TEST",
          "price_bs": 5.00
        },
        "vector_clock": {
          "550e8400-e29b-41d4-a716-446655440001": 1
        }
      }
    ]
  }')

echo "📥 Respuesta del servidor:"
echo "$RESPONSE" | jq .

echo ""
echo "✅ Prueba completada!"
echo ""
echo "Verificá en la BD que el evento se guardó:"
echo "  SELECT event_id, type, vector_clock FROM events ORDER BY received_at DESC LIMIT 1;"
