# ⚙️ Sistema de Validación de Configuración

## 🎯 Objetivo

Antes de permitir generar ventas, el sistema ahora valida que **todas las configuraciones necesarias estén completas**. Esto evita errores como:

- ❌ `No hay series de factura activas configuradas`
- ❌ `No se encontraron mapeos de cuentas para venta`
- ❌ `relation "exchange_rates" does not exist`

---

## ✅ Configuraciones Requeridas

Para poder generar ventas, el sistema requiere que estén configurados:

### 1. 📄 Series de Factura
- **Mínimo**: 1 serie de factura activa
- **Cómo configurar**: Ir a Configuración → Series de Factura
- **Ejemplo**: Serie "A", Prefijo "001-001", Correlativo inicial "00000001"

### 2. 💳 Métodos de Pago
- **Mínimo**: 1 método de pago habilitado
- **Cómo configurar**: Ir a Configuración → Métodos de Pago
- **Métodos disponibles**:
  - CASH_BS (Efectivo Bs)
  - CASH_USD (Efectivo USD)
  - PAGO_MOVIL (Pago Móvil)
  - TRANSFER (Transferencia)
  - OTHER (Otro)
  - SPLIT (Pago mixto)
  - FIAO (Fiado/Crédito)

### 3. 💰 Lista de Precios
- **Mínimo**: 1 lista de precios activa
- **Recomendado**: Tener una lista marcada como predeterminada
- **Cómo configurar**: Ir a Configuración → Listas de Precios

### 4. 📦 Almacén
- **Mínimo**: 1 almacén activo
- **Recomendado**: Tener un almacén marcado como predeterminado
- **Cómo configurar**: Ir a Configuración → Almacenes

---

## 🔧 Implementación Técnica

### Archivos Creados

1. **[config-validation.service.ts](apps/api/src/config/config-validation.service.ts)**
   - Servicio que valida el estado de configuración del sistema
   - Métodos principales:
     - `validateSystemConfiguration(storeId)` - Valida toda la configuración
     - `canGenerateSale(storeId)` - Verifica si se puede generar venta
     - `getConfigurationErrorMessage(storeId)` - Obtiene mensaje de error detallado

2. **[config.controller.ts](apps/api/src/config/config.controller.ts)**
   - Endpoints para verificar configuración
   - `GET /config/status` - Estado completo de configuración
   - `GET /config/can-generate-sale` - Verifica si se puede generar venta

3. **[config.module.ts](apps/api/src/config/config.module.ts)**
   - Módulo que registra el servicio y controlador

4. **[0012_create_exchange_rates_table.sql](apps/api/src/database/migrations/0012_create_exchange_rates_table.sql)**
   - Migración SQL para crear la tabla `exchange_rates`
   - Soluciona el error: `relation "exchange_rates" does not exist`

### Modificaciones Realizadas

1. **[app.module.ts](apps/api/src/app.module.ts:184)**
   - Agregado `SystemConfigModule` al array de imports

2. **[sales.module.ts](apps/api/src/sales/sales.module.ts:54)**
   - Agregado `SystemConfigModule` para que SalesService pueda validar

3. **[sales.service.ts](apps/api/src/sales/sales.service.ts:89-100)**
   - Agregada validación al inicio del método `create()`
   - Si falta configuración, lanza `BadRequestException` con mensaje detallado

---

## 📡 API Endpoints

### GET /config/status

Obtiene el estado completo de configuración del sistema.

**Respuesta:**
```json
{
  "success": true,
  "status": {
    "isComplete": false,
    "missingConfigurations": ["series_factura", "metodos_pago"],
    "warnings": ["No hay almacén predeterminado configurado"],
    "details": {
      "invoiceSeries": {
        "configured": false,
        "activeCount": 0,
        "message": "No hay series de factura configuradas. Debes crear al menos una serie de factura activa."
      },
      "paymentMethods": {
        "configured": false,
        "count": 0,
        "message": "No hay métodos de pago configurados. Debes crear al menos un método de pago activo."
      },
      "priceList": {
        "configured": true,
        "hasDefault": true,
        "count": 1,
        "message": "1 lista(s) de precios configurada(s)"
      },
      "warehouse": {
        "configured": true,
        "hasDefault": false,
        "count": 1,
        "message": "Tienes almacenes pero ninguno está marcado como predeterminado."
      }
    }
  }
}
```

### GET /config/can-generate-sale

Verifica si se puede generar una venta.

**Respuesta (configuración incompleta):**
```json
{
  "success": true,
  "canGenerateSale": false,
  "errorMessage": "⚠️ No se pueden generar ventas. Configuración incompleta:\n\n❌ Series de factura: No hay series de factura configuradas. Debes crear al menos una serie de factura activa.\n❌ Métodos de pago: No hay métodos de pago configurados. Debes crear al menos un método de pago activo.\n\n📋 Por favor, completa la configuración antes de generar ventas."
}
```

**Respuesta (configuración completa):**
```json
{
  "success": true,
  "canGenerateSale": true,
  "errorMessage": null
}
```

---

## 🚨 Comportamiento al Intentar Generar Venta

### ANTES (sin validación):
```
POST /sales

❌ Error 500 Internal Server Error
{
  "statusCode": 500,
  "message": "No se pudo generar número de factura: No hay series de factura activas configuradas"
}
```

### AHORA (con validación):
```
POST /sales

❌ Error 400 Bad Request
{
  "statusCode": 400,
  "message": "⚠️ No se pueden generar ventas. Configuración incompleta:\n\n❌ Series de factura: No hay series de factura configuradas. Debes crear al menos una serie de factura activa.\n❌ Métodos de pago: No hay métodos de pago configurados. Debes crear al menos un método de pago activo.\n\n📋 Por favor, completa la configuración antes de generar ventas.",
  "error": "Bad Request"
}
```

---

## 📋 Checklist de Configuración Inicial

Al configurar una nueva tienda, asegúrate de completar:

- [ ] **Series de Factura** - Crear al menos una serie activa
- [ ] **Métodos de Pago** - Habilitar los métodos de pago que usarás
- [ ] **Lista de Precios** - Crear y marcar una como predeterminada
- [ ] **Almacén** - Crear y marcar uno como predeterminado
- [ ] **Productos** - Agregar productos al inventario
- [ ] **Usuarios/Cajeros** - Crear usuarios con permisos
- [ ] **Sesión de Caja** - Abrir sesión de caja para operar

---

## 🗄️ Migración de Base de Datos

Si ves el error: **`relation "exchange_rates" does not exist`**

Debes ejecutar la migración SQL:

```bash
# Opción 1: Desde Supabase Dashboard
# - Ve a SQL Editor
# - Copia el contenido de: apps/api/src/database/migrations/0012_create_exchange_rates_table.sql
# - Ejecuta

# Opción 2: Desde psql
PGPASSWORD='@bC154356' psql -h aws-1-us-east-1.pooler.supabase.com \
  -U postgres.unycbbictuwzruxshacq \
  -d postgres \
  -p 5432 \
  -f apps/api/src/database/migrations/0012_create_exchange_rates_table.sql
```

---

## 🎯 Próximos Pasos

1. **Frontend**: Crear pantalla de configuración inicial que guíe al usuario a completar todos los requisitos
2. **Dashboard**: Agregar indicador visual del estado de configuración
3. **Onboarding**: Wizard de configuración para nuevas tiendas
4. **Validación Preventiva**: Mostrar advertencias antes de que el usuario intente crear una venta

---

## ✅ Beneficios

- ✅ **Prevención de errores**: Evita errores en tiempo de ejecución
- ✅ **Mejor UX**: Mensajes claros sobre qué falta configurar
- ✅ **Guía al usuario**: Indica exactamente qué configurar y dónde
- ✅ **Consistencia**: Todas las tiendas tienen configuración mínima completa
- ✅ **Mantenibilidad**: Código más robusto y fácil de mantener

---

## 📞 Soporte

Si tienes dudas sobre cómo configurar el sistema:
1. Revisa este documento
2. Verifica el estado con `GET /config/status`
3. Consulta los logs del servidor para ver errores específicos

**¡Tu sistema POS ahora es más robusto y predecible!** 🚀
