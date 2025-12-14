# LA CAJA - Backend: Implementación Completa

Este documento describe toda la implementación del backend API realizada durante los 12 sprints.

## Índice

1. [Arquitectura General](#arquitectura-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Base de Datos](#base-de-datos)
5. [Autenticación y Autorización](#autenticación-y-autorización)
6. [Módulos Implementados](#módulos-implementados)
7. [Event Sourcing y Sincronización](#event-sourcing-y-sincronización)
8. [Proyecciones (Read Models)](#proyecciones-read-models)
9. [Endpoints por Módulo](#endpoints-por-módulo)
10. [Testing](#testing)
11. [Despliegue](#despliegue)

---

## Arquitectura General

El backend implementa una arquitectura **Offline-First** con **Event Sourcing**:

- **Event Log**: Todos los cambios se guardan como eventos
- **Event Ingestion**: Sincronización de eventos desde clientes
- **Proyecciones**: Transformación de eventos a read models optimizados
- **Read Models**: Tablas optimizadas para consultas rápidas (products, sales, customers, etc.)

### Flujo de Datos

1. Cliente crea evento localmente (offline)
2. Cliente sincroniza evento vía `POST /sync/push`
3. Servidor:
   - Valida evento
   - Verifica deduplicación (por `event_id`)
   - Guarda en tabla `events`
   - Proyecta a read models
4. Read models disponibles para consultas rápidas

---

## Stack Tecnológico

- **Framework**: NestJS con Fastify adapter
- **Base de Datos**: PostgreSQL
- **ORM**: TypeORM
- **Autenticación**: JWT (JSON Web Tokens)
- **Validación**: class-validator + class-transformer
- **Criptografía**: bcrypt (para hash de PINs)
- **Lenguaje**: TypeScript

---

## Estructura del Proyecto

```
apps/api/
├── src/
│   ├── main.ts                    # Bootstrap de la aplicación
│   ├── app.module.ts              # Módulo raíz
│   ├── auth/                      # Módulo de autenticación
│   ├── products/                  # Módulo de productos
│   ├── inventory/                 # Módulo de inventario
│   ├── sales/                     # Módulo de ventas
│   ├── cash/                      # Módulo de caja
│   ├── customers/                 # Módulo de clientes
│   ├── debts/                     # Módulo de deudas (FIAO)
│   ├── sync/                      # Módulo de sincronización
│   ├── projections/               # Módulo de proyecciones
│   ├── reports/                   # Módulo de reportes
│   ├── backup/                    # Módulo de backup/restore
│   └── database/
│       ├── entities/              # Entidades TypeORM
│       └── migrations/            # Migraciones SQL
```

---

## Base de Datos

### Tablas Principales

#### 1. Autenticación y Tenancy
- `stores`: Tiendas
- `profiles`: Perfiles de usuario
- `store_members`: Relación usuarios-tiendas (owner/cashier)

#### 2. Event Store
- `events`: Almacenamiento de todos los eventos (Event Sourcing)

#### 3. Read Models (Proyecciones)
- `products`: Productos
- `inventory_movements`: Movimientos de inventario
- `sales`: Ventas
- `sale_items`: Items de venta
- `cash_sessions`: Sesiones de caja
- `customers`: Clientes
- `debts`: Deudas (FIAO)
- `debt_payments`: Pagos de deudas

### Migraciones

Las migraciones están en `apps/api/src/database/migrations/`:

1. `01_stores_and_users.sql` - Tiendas y usuarios
2. `02_events.sql` - Event store
3. `03_products.sql` - Productos
4. `04_inventory.sql` - Inventario
5. `05_cash_sessions.sql` - Caja
6. `06_sales.sql` - Ventas
7. `07_customers_and_debts.sql` - Clientes y deudas

**Orden de ejecución**: Ejecutar en orden numérico usando pgAdmin o psql.

---

## Autenticación y Autorización

### JWT Authentication

- **Estrategia**: JWT Strategy de Passport
- **Algoritmo**: HS256
- **Secret**: Configurado en `JWT_SECRET` (variable de entorno)
- **Expiración**: 7 días (configurable)

### Roles

- **owner**: Propietario de la tienda
- **cashier**: Cajero

### Endpoints de Autenticación

- `POST /auth/stores` - Crear tienda (Owner)
- `POST /auth/cashiers` - Crear cajero (Owner)
- `POST /auth/login` - Login con PIN (Cashier)

### Protección de Endpoints

Todos los endpoints (excepto `/health` y `/auth/*`) requieren autenticación JWT mediante `@UseGuards(JwtAuthGuard)`.

---

## Módulos Implementados

### 1. AuthModule
**Responsabilidad**: Autenticación y autorización

**Funcionalidades**:
- Creación de tiendas
- Creación de cajeros
- Login con PIN
- Generación de JWT tokens

**Archivos**:
- `auth.controller.ts`
- `auth.service.ts`
- `guards/jwt-auth.guard.ts`
- `strategies/jwt.strategy.ts`
- `dto/*.dto.ts`

---

### 2. ProductsModule
**Responsabilidad**: Gestión de productos

**Funcionalidades**:
- CRUD de productos
- Búsqueda rápida (por nombre, SKU, barcode)
- Importación desde CSV
- Cambio rápido de precios
- Cambio masivo de precios (por lista o por categoría)
- Redondeo de precios

**Endpoints**:
- `GET /products` - Listar productos (con filtros)
- `GET /products/:id` - Obtener producto
- `POST /products` - Crear producto
- `PATCH /products/:id` - Actualizar producto
- `POST /products/:id/deactivate` - Desactivar producto
- `PATCH /products/:id/price` - Cambiar precio individual
- `PUT /products/prices/bulk` - Cambio masivo de precios
- `POST /products/import/csv` - Importar desde CSV

---

### 3. InventoryModule
**Responsabilidad**: Gestión de inventario

**Funcionalidades**:
- Recepción de stock
- Ajustes de inventario
- Consulta de stock actual
- Productos con stock bajo
- Historial de movimientos

**Endpoints**:
- `POST /inventory/stock/received` - Registrar recepción
- `POST /inventory/stock/adjust` - Ajustar stock
- `GET /inventory/stock/:productId` - Stock actual
- `GET /inventory/stock/low` - Productos con stock bajo
- `GET /inventory/movements` - Historial de movimientos

---

### 4. SalesModule
**Responsabilidad**: Punto de Venta (POS)

**Funcionalidades**:
- Crear ventas
- Descuento automático de stock
- Múltiples métodos de pago
- Soporte BS/USD con tasa de cambio
- Descuentos por item
- Ventas con cliente (para FIAO)

**Endpoints**:
- `POST /sales` - Crear venta
- `GET /sales` - Listar ventas (con filtros de fecha)
- `GET /sales/:id` - Obtener venta

---

### 5. CashModule
**Responsabilidad**: Gestión de caja

**Funcionalidades**:
- Apertura de sesión de caja
- Cierre de sesión de caja
- Cálculo automático de efectivo esperado
- Reporte de descuadre
- Resumen de sesión

**Endpoints**:
- `POST /cash/sessions/open` - Abrir sesión
- `GET /cash/sessions/current` - Sesión actual
- `POST /cash/sessions/:id/close` - Cerrar sesión
- `GET /cash/sessions/:id/summary` - Resumen de sesión
- `GET /cash/sessions` - Listar sesiones

---

### 6. CustomersModule
**Responsabilidad**: Gestión de clientes

**Funcionalidades**:
- CRUD de clientes
- Búsqueda de clientes

**Endpoints**:
- `GET /customers` - Listar clientes (con búsqueda)
- `GET /customers/:id` - Obtener cliente
- `POST /customers` - Crear cliente
- `PATCH /customers/:id` - Actualizar cliente
- `DELETE /customers/:id` - Eliminar cliente

---

### 7. DebtsModule
**Responsabilidad**: Gestión de deudas (FIAO)

**Funcionalidades**:
- Crear deudas desde ventas
- Registrar pagos de deudas
- Consultar deudas por cliente
- Resúmenes de deuda

**Endpoints**:
- `POST /debts/from-sale/:saleId` - Crear deuda desde venta
- `POST /debts/:id/payments` - Registrar pago
- `GET /debts/customer/:customerId` - Deudas de un cliente
- `GET /debts/customer/:customerId/summary` - Resumen de deudas
- `GET /debts` - Listar todas las deudas
- `GET /debts/:id` - Obtener deuda

---

### 8. SyncModule
**Responsabilidad**: Sincronización de eventos

**Funcionalidades**:
- Push de eventos desde clientes
- Deduplicación por `event_id`
- Validación de eventos
- Estado de sincronización

**Endpoints**:
- `POST /sync/push` - Sincronizar eventos
- `GET /sync/status?device_id=xxx` - Estado de sync
- `GET /sync/last-seq?device_id=xxx` - Última secuencia procesada

**Características**:
- Deduplicación idempotente
- Validación de tipos de eventos
- Manejo robusto de errores
- No reprocesa eventos duplicados

---

### 9. ProjectionsModule
**Responsabilidad**: Proyección de eventos a read models

**Funcionalidades**:
- Proyección automática de eventos
- Actualización de read models
- Idempotencia garantizada

**Eventos Proyectados**:
- `ProductCreated` → `products`
- `ProductUpdated` → `products`
- `ProductDeactivated` → `products`
- `PriceChanged` → `products`
- `StockReceived` → `inventory_movements`
- `StockAdjusted` → `inventory_movements`
- `SaleCreated` → `sales` + `sale_items` + `inventory_movements`
- `CashSessionOpened` → `cash_sessions`
- `CashSessionClosed` → `cash_sessions`
- `CustomerCreated` → `customers`
- `CustomerUpdated` → `customers`
- `DebtCreated` → `debts`
- `DebtPaymentRecorded` → `debt_payments` + actualización de `debts.status`

---

### 10. ReportsModule
**Responsabilidad**: Reportes y análisis

**Funcionalidades**:
- Ventas por día y por método de pago
- Top productos más vendidos
- Resumen de deudas
- Export CSV de ventas

**Endpoints**:
- `GET /reports/sales/by-day` - Ventas por día
- `GET /reports/sales/top-products` - Top productos
- `GET /reports/debts/summary` - Resumen de deudas
- `GET /reports/sales/export/csv` - Export CSV de ventas

---

### 11. BackupModule
**Responsabilidad**: Backup y restore de datos

**Funcionalidades**:
- Crear backup de productos y clientes
- Exportar backup (descarga)
- Restaurar desde backup

**Endpoints**:
- `GET /backup` - Crear backup JSON
- `GET /backup/export` - Descargar backup
- `POST /backup/restore` - Restaurar desde backup

**Características**:
- Solo incluye datos maestros (productos y clientes)
- Restore idempotente (actualiza existentes, crea nuevos)
- Manejo de errores durante restore

---

## Event Sourcing y Sincronización

### Tipos de Eventos Soportados

1. **Productos**:
   - `ProductCreated`
   - `ProductUpdated`
   - `ProductDeactivated`
   - `PriceChanged`

2. **Inventario**:
   - `StockReceived`
   - `StockAdjusted`

3. **Ventas**:
   - `SaleCreated`

4. **Caja**:
   - `CashSessionOpened`
   - `CashSessionClosed`

5. **Clientes**:
   - `CustomerCreated`
   - `CustomerUpdated`

6. **Deudas**:
   - `DebtCreated`
   - `DebtPaymentRecorded`

### Formato de Evento

```json
{
  "event_id": "uuid",
  "seq": 123,
  "type": "SaleCreated",
  "version": 1,
  "created_at": 1734048000000,
  "actor": {
    "user_id": "uuid",
    "role": "cashier"
  },
  "payload": { ... }
}
```

### Flujo de Sincronización

1. Cliente acumula eventos localmente (offline)
2. Cliente llama `POST /sync/push` con array de eventos
3. Servidor:
   - Valida `store_id` vs JWT token
   - Verifica deduplicación (busca `event_id` existentes)
   - Guarda eventos nuevos en `events`
   - Proyecta eventos a read models
4. Servidor responde con `accepted` y `rejected`
5. Cliente marca eventos aceptados como sincronizados

---

## Proyecciones (Read Models)

Las proyecciones transforman eventos en read models optimizados para consultas.

### Proyecciones Implementadas

#### Productos
- `ProductCreated` → Crea registro en `products`
- `ProductUpdated` → Actualiza campos en `products`
- `ProductDeactivated` → Marca `is_active = false`
- `PriceChanged` → Actualiza precios en `products`

#### Inventario
- `StockReceived` → Crea movimiento tipo `received`
- `StockAdjusted` → Crea movimiento tipo `adjust`
- `SaleCreated` → Crea movimientos tipo `sold` (descuento de stock)

#### Ventas
- `SaleCreated` → Crea registro en `sales` + `sale_items` + movimientos de inventario

#### Caja
- `CashSessionOpened` → Crea sesión en `cash_sessions`
- `CashSessionClosed` → Actualiza sesión con datos de cierre

#### Clientes
- `CustomerCreated` → Crea registro en `customers`
- `CustomerUpdated` → Actualiza campos en `customers`

#### Deudas
- `DebtCreated` → Crea deuda en `debts`
- `DebtPaymentRecorded` → Crea pago en `debt_payments` + actualiza status de deuda

### Características

- **Idempotencia**: Puede re-proyectar eventos sin efectos secundarios
- **Manejo de errores**: Errores en proyecciones no afectan el guardado de eventos
- **Automático**: Se ejecuta automáticamente al sincronizar eventos

---

## Endpoints por Módulo

### Autenticación (`/auth`)
- `POST /auth/stores` - Crear tienda
- `POST /auth/cashiers` - Crear cajero
- `POST /auth/login` - Login con PIN

### Productos (`/products`)
- `GET /products` - Listar (con filtros)
- `GET /products/:id` - Obtener
- `POST /products` - Crear
- `PATCH /products/:id` - Actualizar
- `POST /products/:id/deactivate` - Desactivar
- `PATCH /products/:id/price` - Cambiar precio
- `PUT /products/prices/bulk` - Cambio masivo
- `POST /products/import/csv` - Importar CSV

### Inventario (`/inventory`)
- `POST /inventory/stock/received` - Recepción
- `POST /inventory/stock/adjust` - Ajuste
- `GET /inventory/stock/:productId` - Stock actual
- `GET /inventory/stock/low` - Stock bajo
- `GET /inventory/movements` - Historial

### Ventas (`/sales`)
- `POST /sales` - Crear venta
- `GET /sales` - Listar (con filtros)
- `GET /sales/:id` - Obtener

### Caja (`/cash`)
- `POST /cash/sessions/open` - Abrir sesión
- `GET /cash/sessions/current` - Sesión actual
- `POST /cash/sessions/:id/close` - Cerrar sesión
- `GET /cash/sessions/:id/summary` - Resumen
- `GET /cash/sessions` - Listar sesiones

### Clientes (`/customers`)
- `GET /customers` - Listar (con búsqueda)
- `GET /customers/:id` - Obtener
- `POST /customers` - Crear
- `PATCH /customers/:id` - Actualizar
- `DELETE /customers/:id` - Eliminar

### Deudas (`/debts`)
- `POST /debts/from-sale/:saleId` - Crear desde venta
- `POST /debts/:id/payments` - Registrar pago
- `GET /debts/customer/:customerId` - Por cliente
- `GET /debts/customer/:customerId/summary` - Resumen cliente
- `GET /debts` - Listar todas
- `GET /debts/:id` - Obtener

### Sincronización (`/sync`)
- `POST /sync/push` - Sincronizar eventos
- `GET /sync/status?device_id=xxx` - Estado
- `GET /sync/last-seq?device_id=xxx` - Última seq

### Reportes (`/reports`)
- `GET /reports/sales/by-day` - Ventas por día
- `GET /reports/sales/top-products` - Top productos
- `GET /reports/debts/summary` - Resumen deudas
- `GET /reports/sales/export/csv` - Export CSV

### Backup (`/backup`)
- `GET /backup` - Crear backup
- `GET /backup/export` - Descargar backup
- `POST /backup/restore` - Restaurar

---

## Testing

Todos los endpoints han sido probados usando scripts de PowerShell. Los scripts de prueba están documentados en:

- `SPRINT1_API.md` hasta `SPRINT12_API.md`
- Cada sprint incluye ejemplos de uso en PowerShell

### Ejemplo de Prueba

```powershell
# Login
$loginBody = @{ store_id = "uuid"; pin = "1234" } | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" `
    -Method POST -Body $loginBody -ContentType "application/json"
$token = ($loginResponse.Content | ConvertFrom-Json).access_token

# Request autenticado
$headers = @{ Authorization = "Bearer $token" }
$response = Invoke-WebRequest -Uri "http://localhost:3000/products" -Headers $headers
```

---

## Despliegue

### Variables de Entorno

Crear archivo `apps/api/.env`:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/la_caja
JWT_SECRET=tu-secret-super-seguro-aqui
JWT_EXPIRES_IN=7d
```

### Build

```bash
cd apps/api
npm install
npm run build
```

### Ejecución

```bash
npm run start:prod
```

### Migraciones

Ejecutar migraciones SQL en orden:
1. `01_stores_and_users.sql`
2. `02_events.sql`
3. `03_products.sql`
4. `04_inventory.sql`
5. `05_cash_sessions.sql`
6. `06_sales.sql`
7. `07_customers_and_debts.sql`

### Deploy en Render

Ver `DEPLOY.md` para instrucciones completas.

---

## Características Destacadas

### Seguridad
- ✅ Autenticación JWT
- ✅ Autorización por `store_id`
- ✅ Validación de entrada (DTOs con class-validator)
- ✅ Hash de PINs con bcrypt

### Performance
- ✅ Consultas optimizadas con índices
- ✅ Proyecciones en batch
- ✅ Deduplicación eficiente

### Robustez
- ✅ Manejo de errores robusto
- ✅ Transacciones para operaciones críticas
- ✅ Idempotencia en sync y proyecciones
- ✅ Validación exhaustiva

### Escalabilidad
- ✅ Arquitectura modular
- ✅ Event Sourcing preparado para escalar
- ✅ Read models optimizados para consultas

---

## Sprints Completados

✅ **Sprint 0**: Setup total (Monorepo, NestJS, Fastify)
✅ **Sprint 1**: Auth + Tienda + Roles + PIN
✅ **Sprint 2**: Productos + búsqueda + import
✅ **Sprint 3**: Inventario por movimientos
✅ **Sprint 4**: POS ultra rápido
✅ **Sprint 5**: Caja (apertura/cierre/cuadre)
✅ **Sprint 6**: Fiao MVP
✅ **Sprint 7**: Sync Engine v1
✅ **Sprint 8**: Proyecciones server
✅ **Sprint 9**: Precios rápidos + masivo
✅ **Sprint 10**: Reportes MVP + export
✅ **Sprint 11**: Sync resiliente (backend)
✅ **Sprint 12**: Backup/Restore (backend)

---

## Próximos Pasos (Frontend)

El backend está completo y listo para consumo. Los próximos pasos son:

1. **PWA Frontend** (React + Vite + IndexedDB)
   - Implementar UI para todas las funcionalidades
   - Gestión offline de eventos
   - Sincronización con backend

2. **Desktop App** (Tauri + React + SQLite)
   - Misma funcionalidad que PWA
   - Acceso a sistema de archivos
   - Impresión (opcional)

3. **Packages**
   - `packages/domain`: Reglas de negocio puras
   - `packages/application`: Casos de uso
   - `packages/sync`: Motor de sincronización cliente

---

## Documentación Adicional

- `SPRINT1_API.md` hasta `SPRINT12_API.md` - Documentación detallada de cada sprint
- `DEPLOY.md` - Guía de despliegue
- `INSTALL.md` - Guía de instalación
- `roadmap la caja.md` - Roadmap completo del proyecto

---

**Estado**: ✅ Backend completo y probado
**Versión**: 1.0.0
**Fecha**: Diciembre 2025

