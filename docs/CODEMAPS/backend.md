# Backend Codemap - LA-CAJA

**Última Actualización:** 2026-01-22  
**Framework:** NestJS 10+ con Fastify  
**Entry Point:** `apps/api/src/main.ts`

---

## Arquitectura

```
main.ts
  ↓
app.module.ts (Módulo Raíz)
  ↓
[41 Módulos NestJS]
```

---

## Estructura de Directorios

```
apps/api/src/
├── main.ts                    # Bootstrap de la aplicación
├── app.module.ts              # Módulo raíz (importa todos los módulos)
├── app.controller.ts          # Controller raíz
├── app.service.ts             # Service raíz
│
├── auth/                      # Autenticación y autorización
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/                # JWT, Roles, License, Rate Limit
│   ├── strategies/            # JWT Strategy
│   └── dto/                   # Login, Register, etc.
│
├── products/                  # Gestión de productos
├── inventory/                 # Gestión de inventario
├── sales/                     # Gestión de ventas
├── cash/                      # Gestión de caja
├── shifts/                    # Gestión de turnos
├── payments/                  # Métodos de pago
├── discounts/                 # Descuentos
├── fast-checkout/             # Checkout rápido
├── product-variants/          # Variantes de productos
├── product-lots/              # Lotes de productos
├── product-serials/           # Series de productos
├── invoice-series/            # Series de facturas
├── tables/                    # Mesas y órdenes
├── orders/                    # Órdenes
├── peripherals/               # Periféricos
├── price-lists/               # Listas de precios
├── promotions/                # Promociones
├── customers/                 # Clientes
├── debts/                     # Deudas (FIAO)
├── reports/                   # Reportes
├── backup/                    # Backup/Restore
├── exchange/                  # Tipo de cambio
├── warehouses/                # Bodegas
├── transfers/                 # Transferencias
├── suppliers/                 # Proveedores
├── supplier-price-lists/      # Listas de precios de proveedores
├── purchase-orders/           # Órdenes de compra
├── fiscal-configs/            # Configuración fiscal
├── fiscal-invoices/           # Facturas fiscales
├── dashboard/                 # Dashboard
├── ml/                        # Machine Learning
├── realtime-analytics/        # Analytics en tiempo real
├── notifications/             # Notificaciones
├── accounting/                # Contabilidad
├── security/                  # Seguridad y auditoría
├── config/                    # Configuración del sistema
├── setup/                     # Setup inicial
├── licenses/                  # Licencias
├── menu/                      # Menú público
├── kitchen/                   # Display de cocina
├── reservations/              # Reservaciones
├── whatsapp/                  # Integración WhatsApp
├── admin/                     # Administración
├── health/                    # Health checks
├── metrics/                   # Métricas
├── observability/             # Observabilidad
│
├── sync/                      # Sincronización offline-first
│   ├── sync.module.ts
│   ├── sync.controller.ts
│   ├── sync.service.ts
│   ├── crdt.service.ts        # CRDT para conflictos
│   ├── vector-clock.service.ts # Vector clocks
│   └── conflict-resolution.service.ts
│
├── projections/               # Proyecciones (Event Sourcing)
│   ├── projections.module.ts
│   └── projections.service.ts
│
├── database/                   # Base de datos
│   ├── entities/              # 69 entidades TypeORM
│   │   └── index.ts           # Exportación centralizada
│   └── migrations/           # 83+ migraciones SQL
│
└── common/                    # Utilidades compartidas
    ├── decorators/            # Decoradores personalizados
    ├── interceptors/          # Interceptores
    ├── guards/                # Guards compartidos
    ├── pipes/                 # Pipes personalizados
    └── utils/                 # Utilidades
```

---

## Módulos Principales

### Core (Autenticación y Sincronización)

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `auth` | Autenticación JWT, 2FA, PIN | `/auth/login`, `/auth/register`, `/auth/refresh` |
| `sync` | Sincronización offline-first | `/sync/push`, `/sync/pull`, `/sync/conflicts` |
| `projections` | Proyecciones de eventos | Interno (no expuesto) |

### Productos e Inventario

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `products` | Gestión de productos | `/products` |
| `inventory` | Movimientos de inventario | `/inventory` |
| `product-variants` | Variantes de productos | `/product-variants` |
| `product-lots` | Lotes y vencimientos | `/product-lots` |
| `product-serials` | Series de productos | `/product-serials` |

### Ventas y Pagos

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `sales` | Ventas y devoluciones | `/sales` |
| `cash` | Sesiones de caja | `/cash` |
| `shifts` | Turnos y cortes | `/shifts` |
| `payments` | Métodos de pago | `/payments` |
| `discounts` | Descuentos | `/discounts` |
| `fast-checkout` | Checkout rápido | `/fast-checkout` |

### Clientes y Deudas

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `customers` | Clientes | `/customers` |
| `debts` | Deudas (FIAO) | `/debts` |

### Comercial

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `tables` | Mesas y QR codes | `/tables` |
| `orders` | Órdenes de restaurante | `/orders` |
| `reservations` | Reservaciones | `/reservations` |
| `menu` | Menú público | `/menu` |
| `kitchen` | Display de cocina | `/kitchen` |

### Financiero

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `accounting` | Contabilidad | `/accounting` |
| `exchange` | Tipo de cambio | `/exchange` |
| `reports` | Reportes | `/reports` |

### Fiscal

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `fiscal-configs` | Configuración fiscal | `/fiscal-configs` |
| `fiscal-invoices` | Facturas fiscales | `/fiscal-invoices` |
| `invoice-series` | Series de facturas | `/invoice-series` |

### Logística

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `warehouses` | Bodegas | `/warehouses` |
| `transfers` | Transferencias | `/transfers` |
| `suppliers` | Proveedores | `/suppliers` |
| `supplier-price-lists` | Listas de precios | `/supplier-price-lists` |
| `purchase-orders` | Órdenes de compra | `/purchase-orders` |

### Analytics y ML

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `dashboard` | Dashboard ejecutivo | `/dashboard` |
| `ml` | Machine Learning | `/ml` |
| `realtime-analytics` | Analytics en tiempo real | `/realtime-analytics` |

### Sistema

| Módulo | Propósito | Endpoints Principales |
|--------|-----------|----------------------|
| `notifications` | Notificaciones push | `/notifications` |
| `security` | Auditoría de seguridad | `/security` |
| `config` | Configuración | `/config` |
| `setup` | Setup inicial | `/setup` |
| `licenses` | Licencias | `/licenses` |
| `whatsapp` | WhatsApp | `/whatsapp` |
| `admin` | Administración | `/admin` |
| `health` | Health checks | `/health` |
| `metrics` | Métricas | `/metrics` |
| `observability` | Observabilidad | `/observability` |

---

## Flujo de Datos

### Escritura (Command)

```
Cliente → Controller → Service → Event Store (events table)
                              ↓
                         Projection Service
                              ↓
                         Read Model (PostgreSQL)
```

### Lectura (Query)

```
Cliente → Controller → Service → Read Model (PostgreSQL)
                              ↓
                         Response
```

### Sincronización

```
Cliente Offline → IndexedDB (Eventos Locales)
                      ↓
              Cliente Online
                      ↓
              POST /sync/push
                      ↓
              Servidor: Validación + Deduplicación
                      ↓
              Event Store + Proyecciones
                      ↓
              POST /sync/pull
                      ↓
              Cliente: Aplicar Eventos
```

---

## Dependencias Externas

- **PostgreSQL** - Base de datos principal
- **Redis** (opcional) - Caché y búsqueda semántica
- **BullMQ** - Colas de trabajos
- **Socket.IO** - WebSockets para tiempo real
- **Resend** - Envío de emails
- **WhatsApp (Baileys)** - Integración WhatsApp

---

## Patrones Utilizados

1. **Event Sourcing** - Todos los cambios como eventos
2. **CQRS** - Separación comandos/queries
3. **Repository Pattern** - TypeORM repositories
4. **Service Layer** - Lógica de negocio en servicios
5. **DTO Pattern** - Validación con class-validator
6. **Guard Pattern** - Autenticación/autorización
7. **Interceptor Pattern** - Validación store_id, métricas

---

## Configuración

- **Variables de Entorno:** `.env` o `process.env`
- **Validación de Secrets:** `SecretValidator` al iniciar
- **Rate Limiting:** ThrottlerModule (100 req/min)
- **CORS:** Configurado por origen permitido
- **Helmet:** Security headers

---

## Relaciones con Otros Áreas

- **Frontend:** API REST + WebSockets
- **Database:** TypeORM + Migraciones SQL
- **Packages:** Usa `@la-caja/domain`, `@la-caja/sync`
- **Integrations:** WhatsApp, Email, Redis

---

**Ver también:**
- [Frontend Codemap](./frontend.md)
- [Database Codemap](./database.md)
- [Integrations Codemap](./integrations.md)
