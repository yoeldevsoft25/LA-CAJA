# 📦 Scripts de Datos de Prueba

Este directorio contiene scripts SQL para poblar la base de datos con datos de prueba completos.

## 🎯 Script Principal

### `demo_store_complete.sql`

Script completo que crea una tienda de demostración con **todos los datos necesarios** para probar todas las funcionalidades del sistema:

- ✅ Tienda completa
- ✅ Usuarios (owner y cashiers)
- ✅ Productos variados (16 productos en diferentes categorías)
- ✅ Inventario con movimientos históricos
- ✅ Sesiones de caja (abiertas y cerradas)
- ✅ Ventas históricas (~150 ventas de los últimos 30 días)
- ✅ Clientes y deudas
- ✅ Métricas en tiempo real
- ✅ Alertas configuradas y activas
- ✅ Notificaciones
- ✅ Datos de ML (predicciones, recomendaciones, anomalías)
- ✅ Heatmaps de ventas
- ✅ Métricas comparativas

---

## 🚀 Cómo Usar

### En Supabase

1. Abre el **SQL Editor** en tu proyecto de Supabase
2. Asegúrate de que **todas las migraciones** estén ejecutadas
3. Copia y pega el contenido de `demo_store_complete.sql`
4. Ejecuta el script
5. Verifica que se hayan creado los datos correctamente

### En PostgreSQL Local

```bash
# Desde la raíz del proyecto
psql -U postgres -d la_caja -f apps/api/src/database/seed/demo_store_complete.sql
```

---

## 📊 Datos Creados

### Tienda
- **ID**: `550e8400-e29b-41d4-a716-446655440000`
- **Nombre**: "Supermercado Demo LA-CAJA"

### Usuarios
- **Owner**: Juan Pérez (`660e8400-e29b-41d4-a716-446655440001`)
- **Cashier**: María González (`660e8400-e29b-41d4-a716-446655440002`)
- **Cashier**: Carlos Rodríguez (`660e8400-e29b-41d4-a716-446655440003`)

### Productos
- 16 productos en categorías: Alimentos, Bebidas, Lácteos, Limpieza
- Algunos productos con **stock bajo** para generar alertas

### Ventas
- ~150 ventas distribuidas en los últimos 30 días
- Diferentes monedas (BS, USD, MIXED)
- Diferentes métodos de pago (CASH_BS, CASH_USD, PAGO_MOVIL, TRANSFER)
- Algunas ventas asociadas a clientes

### Clientes y Deudas
- 5 clientes
- 3 deudas (2 abiertas, 1 parcial con pagos)

### Métricas y Alertas
- Métricas en tiempo real (ventas, inventario, ticket promedio)
- 3 umbrales de alertas configurados
- 3 alertas activas (stock bajo, deuda vencida)

### Notificaciones
- Notificaciones para owner y cashiers
- Diferentes tipos: alert, info, warning, success
- Badges de notificaciones no leídas

### ML y Analytics
- Predicciones de demanda para productos
- Recomendaciones de productos
- Anomalías detectadas
- Métricas de modelos ML
- Heatmaps de ventas (últimos 7 días)
- Métricas comparativas (semanal y mensual)

---

## 🔍 Verificar Datos

Después de ejecutar el script, puedes verificar los datos con estas queries:

```sql
-- Ver tienda
SELECT * FROM stores WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Ver usuarios
SELECT * FROM profiles WHERE id IN (
  '660e8400-e29b-41d4-a716-446655440001',
  '660e8400-e29b-41d4-a716-446655440002',
  '660e8400-e29b-41d4-a716-446655440003'
);

-- Ver productos
SELECT name, category, price_bs, price_usd FROM products 
WHERE store_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY category, name;

-- Ver ventas del día
SELECT COUNT(*) as ventas_hoy, 
       SUM((totals->>'total_bs')::numeric) as total_bs,
       SUM((totals->>'total_usd')::numeric) as total_usd
FROM sales 
WHERE store_id = '550e8400-e29b-41d4-a716-446655440000'
  AND DATE(sold_at) = CURRENT_DATE;

-- Ver alertas activas
SELECT title, severity, is_read, created_at 
FROM real_time_alerts 
WHERE store_id = '550e8400-e29b-41d4-a716-446655440000'
  AND is_read = false
ORDER BY created_at DESC;

-- Ver notificaciones no leídas
SELECT title, notification_type, priority, created_at 
FROM notifications 
WHERE store_id = '550e8400-e29b-41d4-a716-446655440000'
  AND is_read = false
ORDER BY created_at DESC;

-- Ver métricas en tiempo real
SELECT metric_name, metric_value, change_percentage, period_type
FROM real_time_metrics 
WHERE store_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at DESC
LIMIT 10;
```

---

## ⚠️ Notas Importantes

1. **Ejecutar después de migraciones**: Asegúrate de que todas las migraciones estén ejecutadas antes de correr este script.

2. **IDs fijos**: Los IDs están fijos para facilitar las pruebas. Si necesitas ejecutar el script múltiples veces, primero elimina los datos existentes o modifica los IDs.

3. **Datos realistas**: Los datos están diseñados para ser realistas y cubrir todos los casos de uso:
   - Productos con stock bajo (para alertas)
   - Deudas abiertas y parciales
   - Ventas en diferentes monedas
   - Métricas con cambios porcentuales
   - Notificaciones de diferentes tipos

4. **Rendimiento**: El script genera ~150 ventas con sus items. En bases de datos grandes, esto puede tomar unos segundos.

---

## 🧹 Limpiar Datos

Si necesitas eliminar todos los datos de prueba:

```sql
BEGIN;

-- Eliminar en orden inverso de dependencias
DELETE FROM notification_badges WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM notification_deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE store_id = '550e8400-e29b-41d4-a716-446655440000');
DELETE FROM notification_subscriptions WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM notification_preferences WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM notifications WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM real_time_alerts WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM alert_thresholds WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM real_time_metrics WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM comparative_metrics WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM sales_heatmap WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM ml_model_metrics WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM detected_anomalies WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM product_recommendations WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM demand_predictions WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM debt_payments WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM debts WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM customers WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = '550e8400-e29b-41d4-a716-446655440000');
DELETE FROM sales WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM cash_sessions WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM inventory_movements WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM products WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM store_members WHERE store_id = '550e8400-e29b-41d4-a716-446655440000';
DELETE FROM profiles WHERE id IN ('660e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440003');
DELETE FROM stores WHERE id = '550e8400-e29b-41d4-a716-446655440000';

COMMIT;
```

---

## 📝 Personalización

Si necesitas modificar los datos:

1. **Cambiar IDs**: Busca y reemplaza los UUIDs fijos por `gen_random_uuid()` si quieres IDs aleatorios
2. **Más productos**: Agrega más productos en la sección 2
3. **Más ventas**: Modifica el loop en la sección 6 (cambia `1..150` a un número mayor)
4. **Diferentes fechas**: Ajusta los intervalos de tiempo según necesites

---

**Última actualización**: 2025-12-18

