# Frontend Codemap - LA-CAJA

**Última Actualización:** 2026-01-22  
**Framework:** React 18+ con TypeScript  
**Build Tool:** Vite  
**Entry Point:** `apps/pwa/src/main.tsx`

---

## Arquitectura

```
main.tsx
  ↓
App.tsx (Router)
  ↓
[38 Páginas]
  ↓
[191 Componentes]
  ↓
[42 Servicios API]
```

---

## Estructura de Directorios

```
apps/pwa/src/
├── main.tsx                   # Entry point
├── App.tsx                     # Router principal
├── App.css                     # Estilos globales (eliminado - no usado)
│
├── pages/                      # Páginas principales (38 páginas)
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── POSPage.tsx             # Página POS (2,197 líneas - requiere refactor)
│   ├── ProductsPage.tsx
│   ├── SalesPage.tsx
│   ├── InventoryPage.tsx
│   ├── CustomersPage.tsx
│   ├── DebtsPage.tsx
│   ├── CashPage.tsx
│   ├── ShiftsPage.tsx
│   ├── ReportsPage.tsx
│   ├── AccountingPage.tsx
│   ├── FiscalInvoicesPage.tsx
│   ├── AdminPage.tsx
│   ├── LandingPageEnhanced.tsx # Landing page (2,356 líneas - requiere refactor)
│   └── [24 páginas más]
│
├── components/                 # Componentes reutilizables (191 componentes)
│   ├── pos/                    # Componentes POS
│   │   ├── CheckoutModal.tsx   # (1,916 líneas - requiere refactor)
│   │   └── SplitPaymentManager.tsx
│   ├── products/               # Componentes de productos
│   │   ├── ProductFormModal.tsx # (1,241 líneas - requiere refactor)
│   │   └── [más componentes]
│   ├── sales/                  # Componentes de ventas
│   ├── inventory/              # Componentes de inventario
│   ├── accounting/             # Componentes contables
│   ├── fiscal/                 # Componentes fiscales
│   ├── admin/                  # Componentes administrativos
│   └── ui/                     # Componentes UI (Shadcn)
│
├── services/                   # Servicios API (42 servicios)
│   ├── auth.service.ts
│   ├── sales.service.ts        # (965 líneas - considerar dividir)
│   ├── sync.service.ts         # (846 líneas - límite aceptable)
│   ├── products.service.ts
│   ├── inventory.service.ts
│   └── [37 servicios más]
│
├── hooks/                      # Custom hooks (28 hooks)
│   ├── use-modal.ts            # (eliminado - no usado)
│   ├── usePWAInstall.ts
│   ├── useRealtimeMetrics.ts
│   └── [26 hooks más]
│
├── stores/                     # Estado global (Zustand)
│   ├── auth.store.ts
│   ├── cart.store.ts
│   └── notifications.store.ts
│
├── db/                         # IndexedDB (Dexie)
│   └── database.ts
│
├── lib/                        # Utilidades
│   ├── api.ts                  # Cliente Axios configurado
│   ├── logger.ts               # Logger centralizado (nuevo)
│   └── toast.ts
│
├── types/                      # Tipos TypeScript
│   ├── accounting.types.ts
│   ├── ml.types.ts
│   ├── notifications.types.ts
│   └── split-payment.types.ts
│
├── utils/                      # Utilidades
│   ├── export-excel.ts
│   ├── rif-validator.ts
│   ├── whatsapp.ts
│   └── vzla-denominations.ts
│
├── sw/                         # Service Worker
│   └── background-sync-handler.ts # (eliminado - no usado)
│
├── design-system/              # Design system
│   └── tokens/                 # Tokens de diseño
│
└── layouts/                    # Layouts
    ├── AuthLayout.tsx
    └── MainLayout.tsx          # (929 líneas - considerar dividir)
```

---

## Flujo de Datos

### Autenticación

```
LoginPage → auth.service → API /auth/login
                              ↓
                         JWT Token
                              ↓
                         auth.store (Zustand)
                              ↓
                         localStorage
```

### Sincronización Offline

```
Usuario crea evento → sync.service → IndexedDB (localEvents)
                                      ↓
                                 POST /sync/push (cuando online)
                                      ↓
                                 Servidor procesa
                                      ↓
                                 POST /sync/pull
                                      ↓
                                 Aplicar eventos locales
```

### Estado Global

```
Zustand Stores:
- auth.store: Usuario autenticado, token
- cart.store: Carrito de compras
- notifications.store: Notificaciones
```

### Cache Local

```
React Query:
- Cache de queries API
- staleTime configurado
- refetchInterval para datos en tiempo real
```

---

## Servicios API

### Core

| Servicio | Propósito | Endpoints Principales |
|----------|-----------|----------------------|
| `auth.service.ts` | Autenticación | `/auth/*` |
| `sync.service.ts` | Sincronización | `/sync/*` |

### Productos e Inventario

| Servicio | Propósito |
|----------|-----------|
| `products.service.ts` | Productos |
| `inventory.service.ts` | Inventario |
| `product-lots.service.ts` | Lotes |
| `product-serials.service.ts` | Series |

### Ventas y Pagos

| Servicio | Propósito |
|----------|-----------|
| `sales.service.ts` | Ventas |
| `cash.service.ts` | Caja |
| `shifts.service.ts` | Turnos |
| `payments.service.ts` | Pagos |
| `discounts.service.ts` | Descuentos |

### Otros

42 servicios totales cubriendo todos los módulos del backend.

---

## Componentes Principales

### POS

- `POSPage.tsx` - Página principal POS (2,197 líneas)
- `CheckoutModal.tsx` - Modal de checkout (1,916 líneas)
- `SplitPaymentManager.tsx` - Gestión de pagos divididos

### Productos

- `ProductFormModal.tsx` - Formulario de producto (1,241 líneas)
- `ProductsPage.tsx` - Lista de productos (1,059 líneas)

### Ventas

- `SalesPage.tsx` - Lista de ventas (1,126 líneas)
- `SaleDetailModal.tsx` - Detalle de venta (1,070 líneas)

---

## Dependencias Principales

- **React 18+** - Framework UI
- **React Router** - Routing
- **React Query** - Data fetching y cache
- **Zustand** - State management
- **Dexie** - IndexedDB wrapper
- **Axios** - HTTP client
- **Shadcn UI** - Componentes UI
- **Framer Motion** - Animaciones
- **Chart.js / Recharts** - Gráficos

---

## Patrones Utilizados

1. **Component Composition** - Componentes pequeños y reutilizables
2. **Custom Hooks** - Lógica reutilizable
3. **Service Layer** - Abstracción de API
4. **State Management** - Zustand para estado global
5. **Data Fetching** - React Query para cache
6. **Offline-First** - IndexedDB + Sync service

---

## Relaciones con Otros Áreas

- **Backend:** API REST + WebSockets
- **Database:** IndexedDB (Dexie) para cache local
- **Packages:** Usa `@la-caja/domain`, `@la-caja/sync`

---

**Ver también:**
- [Backend Codemap](./backend.md)
- [Database Codemap](./database.md)
- [Packages Codemap](./packages.md)
