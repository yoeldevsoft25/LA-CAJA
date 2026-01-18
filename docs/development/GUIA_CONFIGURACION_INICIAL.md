# 🚀 Guía de Configuración Inicial del Sistema POS

## 📋 Orden de Configuración Obligatorio

Sigue este orden **exactamente** para evitar errores. Cada paso es **obligatorio** antes de poder generar ventas.

---

## 1️⃣ Migración de Base de Datos (PRIMERO)

### ❗ CRÍTICO: Crear tabla `exchange_rates`

**Síntoma si no está hecha**: Error `relation "exchange_rates" does not exist`

**Solución**:
```bash
# Opción A: Desde Supabase Dashboard (Recomendado)
# 1. Ve a https://supabase.com/dashboard
# 2. Selecciona tu proyecto
# 3. Ve a SQL Editor (ícono de base de datos)
# 4. Copia y pega el contenido del archivo:
#    apps/api/src/database/migrations/0012_create_exchange_rates_table.sql
# 5. Click en "Run" o "Ejecutar"

# Opción B: Desde terminal
PGPASSWORD='@bC154356' psql \
  -h aws-1-us-east-1.pooler.supabase.com \
  -U postgres.unycbbictuwzruxshacq \
  -d postgres \
  -p 5432 \
  -f apps/api/src/database/migrations/0012_create_exchange_rates_table.sql
```

**✅ Verificar que funcionó**:
```sql
-- Ejecuta esto en Supabase SQL Editor
SELECT * FROM exchange_rates LIMIT 1;
-- Si no da error, la tabla existe
```

---

## 2️⃣ Configurar Almacén (warehouse)

**Por qué primero**: Los productos necesitan un almacén para gestionar inventario.

### Pasos:
1. Ve a **Configuración → Almacenes** (o `/warehouses`)
2. Click en **"Nuevo Almacén"** o **"+ Agregar"**
3. Completa:
   - **Nombre**: `Almacén Principal` (o el que prefieras)
   - **Código**: `ALM-001` (opcional)
   - **Descripción**: `Almacén principal de la tienda`
   - **✅ Marcar como predeterminado**: `true`
   - **✅ Activo**: `true`
4. Guardar

**✅ Estado esperado**:
```json
{
  "id": "uuid-generado",
  "name": "Almacén Principal",
  "is_default": true,
  "is_active": true
}
```

---

## 3️⃣ Configurar Lista de Precios

**Por qué ahora**: Los productos necesitan precios antes de venderse.

### Pasos:
1. Ve a **Configuración → Listas de Precios** (o `/price-lists`)
2. Click en **"Nueva Lista"**
3. Completa:
   - **Nombre**: `Lista General` o `Precio Público`
   - **Código**: `PUB-001` (opcional)
   - **Descripción**: `Lista de precios general para clientes`
   - **✅ Marcar como predeterminada**: `true`
   - **✅ Activa**: `true`
   - **Tipo**: `Venta` (no compra)
4. Guardar

**✅ Estado esperado**:
```json
{
  "id": "uuid-generado",
  "name": "Lista General",
  "is_default": true,
  "is_active": true
}
```

---

## 4️⃣ Configurar Métodos de Pago

**Por qué ahora**: Sin métodos de pago, no puedes cobrar.

### Pasos:
1. Ve a **Configuración → Métodos de Pago** (o `/payment-methods`)
2. Habilita AL MENOS uno de estos métodos:

**Métodos disponibles**:
- ✅ `CASH_BS` - Efectivo en Bolivianos (recomendado activar primero)
- ✅ `CASH_USD` - Efectivo en Dólares
- ✅ `PAGO_MOVIL` - Pago Móvil (QR)
- ✅ `TRANSFER` - Transferencia Bancaria
- ✅ `FIAO` - Fiado/Crédito (ventas a cuenta)
- ✅ `SPLIT` - Pago Mixto (efectivo + otro)
- ✅ `OTHER` - Otro método

**Configuración mínima recomendada**:
```
✅ CASH_BS (Efectivo Bs) - enabled: true
✅ CASH_USD (Efectivo USD) - enabled: true
✅ PAGO_MOVIL - enabled: true
```

**Cada método puede tener** (opcional):
- **Monto mínimo** (Bs/USD)
- **Monto máximo** (Bs/USD)
- **Requiere autorización**: Si necesita aprobación del gerente

**✅ Estado esperado**:
Al menos 1 método con `enabled: true`

---

## 5️⃣ Configurar Series de Factura

**Por qué último**: Depende de tener almacén y métodos de pago configurados.

**Síntoma si falta**: Error `No hay series de factura activas configuradas`

### Pasos:
1. Ve a **Configuración → Series de Factura** (o `/invoice-series`)
2. Click en **"Nueva Serie"**
3. Completa:
   - **Serie**: `A` (o la letra que uses)
   - **Prefijo**: `001-001` (ejemplo: punto de venta 001, sucursal 001)
   - **Correlativo inicial**: `00000001` (8 dígitos)
   - **Correlativo actual**: `00000001` (se auto-incrementa)
   - **Tipo de documento**: `Factura` (o el que uses)
   - **✅ Activa**: `true`
   - **Descripción**: `Serie principal para ventas`
4. Guardar

**Ejemplo de serie válida**:
```
Serie: A
Prefijo: 001-001
Número actual: 00000001

Resultado: A-001-001-00000001
```

**✅ Estado esperado**:
```json
{
  "id": "uuid-generado",
  "series": "A",
  "prefix": "001-001",
  "current_number": 1,
  "is_active": true
}
```

---

## 6️⃣ Agregar Productos (Opcional pero recomendado)

No es obligatorio para el sistema, pero necesitas productos para vender.

### Pasos:
1. Ve a **Productos** (o `/products`)
2. Click en **"Nuevo Producto"**
3. Completa información básica:
   - **Nombre**: Nombre del producto
   - **Código de barras**: Escanea o escribe manualmente
   - **Precio**: Precio de venta
   - **Costo**: Precio de compra (opcional)
   - **Categoría**: Asigna categoría
   - **Almacén**: Selecciona el almacén creado
   - **Stock inicial**: Cantidad disponible
4. Guardar

---

## 7️⃣ Crear Usuarios/Cajeros

Para que los empleados puedan usar el sistema.

### Pasos:
1. Ve a **Configuración → Usuarios** (o `/users`)
2. Click en **"Nuevo Usuario"**
3. Completa:
   - **Nombre completo**
   - **Email** (será el usuario de login)
   - **Rol**: Cajero, Vendedor, Gerente, etc.
   - **PIN**: Para login rápido (4-6 dígitos)
   - **Permisos**: Asignar según rol
4. Guardar

---

## 8️⃣ Abrir Sesión de Caja

Antes de generar ventas, el cajero debe abrir una sesión de caja.

### Pasos:
1. Ve a **Caja** (o `/cash`)
2. Click en **"Abrir Sesión de Caja"**
3. Completa:
   - **Monto inicial en Bs**: Efectivo de arranque en bolivianos
   - **Monto inicial en USD**: Efectivo de arranque en dólares
   - **Cajero**: Selecciona el usuario
   - **Notas**: Cualquier observación
4. Click en **"Abrir Caja"**

**✅ Estado esperado**:
```json
{
  "id": "uuid-generado",
  "status": "open",
  "opening_cash_bs": 100.00,
  "opening_cash_usd": 20.00,
  "opened_at": "2026-01-07T...",
  "closed_at": null
}
```

---

## ✅ Verificar Configuración Completa

### Opción 1: Desde la API

```bash
# Endpoint para verificar configuración
curl -X GET "https://la-caja-8i4h.onrender.com/config/status" \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

**Respuesta esperada (configuración completa)**:
```json
{
  "success": true,
  "status": {
    "isComplete": true,
    "missingConfigurations": [],
    "warnings": [],
    "details": {
      "invoiceSeries": {
        "configured": true,
        "activeCount": 1,
        "message": "1 serie(s) de factura activa(s)"
      },
      "paymentMethods": {
        "configured": true,
        "count": 3,
        "message": "3 método(s) de pago activo(s)"
      },
      "priceList": {
        "configured": true,
        "hasDefault": true,
        "count": 1,
        "message": "1 lista(s) de precios configurada(s)"
      },
      "warehouse": {
        "configured": true,
        "hasDefault": true,
        "count": 1,
        "message": "1 almacén(es) configurado(s)"
      }
    }
  }
}
```

### Opción 2: Intentar crear una venta

Si al intentar crear una venta obtienes:

**❌ Configuración incompleta**:
```json
{
  "statusCode": 400,
  "message": "⚠️ No se pueden generar ventas. Configuración incompleta:\n\n❌ Series de factura: No hay series...",
  "error": "Bad Request"
}
```

**✅ Configuración completa**:
La venta se crea exitosamente con código 201.

---

## 📊 Resumen del Orden de Configuración

| # | Paso | Obligatorio | Depende de |
|---|------|-------------|------------|
| 1 | Ejecutar migración `exchange_rates` | ✅ Sí | - |
| 2 | Crear Almacén | ✅ Sí | - |
| 3 | Crear Lista de Precios | ✅ Sí | - |
| 4 | Habilitar Métodos de Pago | ✅ Sí | - |
| 5 | Crear Serie de Factura | ✅ Sí | Almacén, Métodos de Pago |
| 6 | Agregar Productos | ⚠️ Recomendado | Almacén, Lista de Precios |
| 7 | Crear Usuarios/Cajeros | ⚠️ Recomendado | - |
| 8 | Abrir Sesión de Caja | ✅ Sí (para operar) | Usuario/Cajero |

---

## 🚨 Errores Comunes y Soluciones

### Error: `relation "exchange_rates" does not exist`
**Solución**: Ejecutar la migración del paso 1

### Error: `No hay series de factura activas configuradas`
**Solución**: Completar el paso 5 (Series de Factura)

### Error: `No hay métodos de pago configurados`
**Solución**: Completar el paso 4 (Métodos de Pago)

### Error: `No hay listas de precios configuradas`
**Solución**: Completar el paso 3 (Lista de Precios)

### Error: `No hay almacenes configurados`
**Solución**: Completar el paso 2 (Almacén)

### Error: `No hay sesión de caja abierta`
**Solución**: Completar el paso 8 (Abrir Sesión de Caja)

---

## 🎯 Configuración Mínima para Ambiente de Prueba

Si solo quieres probar rápidamente:

```
1. ✅ Migración exchange_rates
2. ✅ 1 Almacén (predeterminado)
3. ✅ 1 Lista de Precios (predeterminada)
4. ✅ 1 Método de Pago (CASH_BS habilitado)
5. ✅ 1 Serie de Factura (activa)
6. ✅ 1 Sesión de Caja abierta
```

Con esto, el sistema ya permite generar ventas.

---

## 🚀 Configuración Completa para Producción

Para usar en producción, además de lo anterior:

```
✅ Múltiples almacenes si tienes sucursales
✅ Varias listas de precios (mayorista, minorista, etc.)
✅ Todos los métodos de pago que aceptes
✅ Series de factura para cada tipo de documento
✅ Todos tus productos con stock actualizado
✅ Usuarios con roles y permisos bien definidos
✅ Categorías de productos organizadas
✅ Proveedores registrados (si haces compras)
✅ Clientes frecuentes registrados
✅ Configuración de impresoras (si usas impresión térmica)
```

---

## 📞 Soporte

Si después de seguir esta guía tienes problemas:
1. Verifica el estado con: `GET /config/status`
2. Revisa los logs del servidor en Render
3. Confirma que ejecutaste la migración de `exchange_rates`

**¡Ahora tu sistema POS está listo para operar!** 🎉
