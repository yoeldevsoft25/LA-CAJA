# 🎯 Ejecutar Datos de Prueba Completos

Este script crea **todos los datos de prueba** necesarios para trabajar con LA CAJA.

## 📋 Contenido del Script

El script `complete-test-data.sql` incluye:

### ✅ Datos Creados

1. **Tienda**
   - Supermercado La Caja

2. **Usuarios (3)**
   - 1 Owner (Carlos Rodríguez)
   - 2 Cajeros:
     - María González (PIN: `1234`)
     - José Martínez (PIN: `5678`)

3. **Productos (20)**
   - Bebidas (4): Coca Cola, Pepsi, Agua, Jugos
   - Alimentos básicos (5): Arroz, Azúcar, Harina, Aceite, Pasta
   - Lácteos (3): Leche, Queso, Mantequilla
   - Snacks (3): Doritos, Galletas, Chicles
   - Limpieza (4): Detergente, Cloro, Papel higiénico, Jabón
   - Higiene personal (3): Shampoo, Crema dental, Desodorante
   - Carnes (2): Pollo, Carne molida

4. **Clientes (6)**
   - Con nombres, teléfonos y notas

5. **Inventario**
   - Stock inicial configurado según tipo de producto

6. **Sesión de Caja**
   - 1 sesión abierta con efectivo inicial

7. **Ventas (3)**
   - Venta al contado (Bs)
   - Venta mixta (Bs + USD)
   - Venta fiada (con deuda pendiente)

8. **Deudas**
   - 1 deuda pendiente asociada a una venta

---

## 🚀 Cómo Ejecutar

### Paso 1: Abrir SQL Editor en Supabase

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú izquierdo, haz clic en **SQL Editor**
4. Haz clic en **New query**

### Paso 2: Ejecutar el Script

1. Abre el archivo: `apps/api/src/database/scripts/complete-test-data.sql`
2. Copia **todo** el contenido (Ctrl+A, Ctrl+C)
3. Pega el contenido en el SQL Editor de Supabase (Ctrl+V)
4. Haz clic en **Run** (o presiona Ctrl+Enter)

### Paso 3: Verificar

El script mostrará un resumen al final. También puedes verificar manualmente:

```sql
-- Ver tienda
SELECT * FROM stores;

-- Ver productos
SELECT name, category, price_bs, price_usd FROM products ORDER BY category, name;

-- Ver clientes
SELECT name, phone, note FROM customers;

-- Ver ventas
SELECT s.sold_at, s.currency, s.totals->>'total_bs' as total_bs, c.name as customer
FROM sales s
LEFT JOIN customers c ON c.id = s.customer_id
ORDER BY s.sold_at DESC;

-- Ver deudas pendientes
SELECT c.name, d.amount_bs, d.amount_usd, d.status
FROM debts d
JOIN customers c ON c.id = d.customer_id
WHERE d.status = 'open';
```

---

## 🔐 Credenciales de Prueba

### Cajeros

- **María González**
  - PIN: `1234`
  - Role: cashier

- **José Martínez**
  - PIN: `5678`
  - Role: cashier

### Datos Importantes

- **Store ID:** `11111111-1111-1111-1111-111111111111`
- **Tasa de cambio:** 30 Bs/USD (configurada en ventas)
- **Sesión de caja:** Abierta con 500 Bs y 20 USD

---

## 📊 Ejemplos de Productos

| Producto | Categoría | Precio Bs | Precio USD | Stock Inicial |
|----------|-----------|-----------|------------|---------------|
| Coca Cola 2L | Bebidas | 15.50 | 0.50 | 50 |
| Arroz 1kg | Alimentos | 18.00 | 0.60 | 50 |
| Leche 1L | Lácteos | 22.00 | 0.73 | 50 |
| Detergente 1kg | Limpieza | 32.00 | 1.07 | 50 |
| Pollo 1kg | Carnes | 45.00 | 1.50 | 25 |

---

## ⚠️ Notas Importantes

1. **Si ejecutas el script dos veces:** Los datos se actualizarán (ON CONFLICT), no se duplicarán
2. **Los UUIDs son fijos** para facilitar las pruebas y referencias
3. **El stock se ajusta automáticamente** según las ventas creadas
4. **Todas las fechas son relativas** (hace X días) para que sean realistas

---

## ✅ Después de Ejecutar

1. **Recarga el frontend** - Deberías ver:
   - La tienda "Supermercado La Caja"
   - Todos los productos en el POS
   - Clientes disponibles
   - Ventas históricas

2. **Prueba el login:**
   - Usa el PIN `1234` o `5678`

3. **Explora las funcionalidades:**
   - Ver productos
   - Hacer ventas
   - Ver clientes
   - Gestionar inventario
   - Ver reportes

---

¡Todo listo para trabajar! 🎉
