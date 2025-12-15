0) Arquitectura definitiva 2025 para este caso
Patrón

Offline-first + Event Log (en cliente) + Event Ingestion (en servidor) + Proyecciones (read models)

Cliente guarda TODO como eventos en DB local (nunca “depende” de internet).

Sync hace push de eventos al servidor.

Servidor:

Deduplica por event_id

Guarda en events

Proyecta a tablas de consulta (sales, debts, inventory_movements, etc.)

Reportes leen de esas tablas (rápido, simple).

Capas (para no romper luego)

packages/domain: reglas puras (sin DB, sin HTTP)

packages/application: casos de uso (orquestación)

packages/sync: cola, estados, conflict rules

apps/*: UI + adapters (IndexedDB/SQLite) + API calls

1) Roadmap definitivo de sprints (12 sprints de 1 semana)

Esto ya está “ordenado” para que llegues a MVP operativo sin re-trabajo.

Sprint 0 — Setup total (repo, deploy, storage, versiones)

 Monorepo creado (apps + packages)

 NestJS + Fastify corriendo (/health)

 Deploy API (Render) + deploy PWA (Vercel/Netlify/Render static)

 Tauri Windows: build debug/release

 Storage:

 PWA: Dexie/IndexedDB

 Desktop: SQLite + migraciones + schema_version

 device_id persistente (UUID generado una vez)

 Estructura base de evento (sección 2) + tabla local_events

Salida sprint 0: app abre en PWA + Desktop y guarda eventos offline persistentes.

Sprint 1 — Auth + Tienda + Roles + PIN

 Tablas server: stores, profiles, store_members

 Owner crea tienda

 Owner crea cajero

 Cajero entra con PIN (login rápido)

 RLS por store_id (si usas Supabase)

Sprint 2 — Productos + búsqueda + import simple

 CRUD productos

 Búsqueda rápida

 Import básico (pegar CSV / archivo)

 Eventos: ProductCreated, ProductUpdated, ProductDeactivated, PriceChanged

Sprint 3 — Inventario por movimientos

 Entradas (StockReceived)

 Ajustes (StockAdjusted)

 Stock bajo (umbral)

 Read model local actualizado por eventos

Sprint 4 — POS ultra rápido (offline)

 Carrito, cantidades, totales

 Bs/USD + tasa editable

 Medios de pago

 Evento SaleCreated (+ genera movimientos de stock)

Sprint 5 — Caja (apertura/cierre/cuadre)

 CashSessionOpened, CashSessionClosed

 Descudre + nota

 Resumen del día (local)

Sprint 6 — Fiao MVP

 Clientes (CustomerCreated, CustomerUpdated)

 Venta a fiao (DebtCreated)

 Abonos (DebtPaymentRecorded)

 Historial + saldo

Sprint 7 — Sync Engine v1 (push + dedupe + reintentos)

 local_events + estados

 POST /sync/push en API

 Dedupe server por event_id

 Persistencia server en events

Sprint 8 — Proyecciones server (read models) mínimas

 Proyectar eventos a:

products

inventory_movements

sales

cash_sessions

customers

debts

debt_payments

Sprint 9 — Precios rápidos + masivo

 Editar precio individual rápido

 Masivo por categoría / %

 Redondeo simple

Sprint 10 — Reportes MVP + export

 Ventas por día + por medio de pago

 Top productos

 Fiao: deuda total + top deudores

 Export CSV

Sprint 11 — Operación real (UX + teclado + estabilidad)

 Atajos teclado Desktop

 Optimización POS (<15s por venta)

 Sync resiliente (cola visible + reintentar)

 Impresión simple (opcional recomendado en Desktop)

Sprint 12 — Piloto (instalación, backup/restore, manual)

 Instalador Windows

 Backup SQLite (1 clic) + Restore (Owner)

 Manual corto + checklist instalación

 Videos rápidos (venta, cierre, fiao)

2) Contrato definitivo de eventos (MVP) — Tipos + payloads
2.1 Envoltura estándar de evento (en cliente y server)
{
  "event_id": "uuid",
  "store_id": "uuid",
  "device_id": "uuid",
  "seq": 123,
  "type": "SaleCreated",
  "version": 1,
  "created_at": 1734048000000,
  "actor": { "user_id": "uuid", "role": "owner|cashier" },
  "payload": { }
}

Reglas

event_id único global (UUIDv4).

seq es incremental local (SQLite autoincrement / IndexedDB counter).

created_at epoch ms.

version te permite evolucionar sin romper eventos viejos.

2.2 Eventos de catálogo y precios
ProductCreated v1
{
  "product_id": "uuid",
  "name": "Coca Cola 1.5L",
  "category": "Bebidas",
  "sku": "optional",
  "barcode": "optional",
  "price_bs": 0,
  "price_usd": 0,
  "cost_bs": 0,
  "cost_usd": 0,
  "is_active": true,
  "low_stock_threshold": 5
}

ProductUpdated v1
{
  "product_id": "uuid",
  "patch": {
    "name": "string?",
    "category": "string?",
    "sku": "string?",
    "barcode": "string?",
    "low_stock_threshold": 10
  }
}

ProductDeactivated v1
{ "product_id": "uuid", "is_active": false }

PriceChanged v1
{
  "product_id": "uuid",
  "price_bs": 0,
  "price_usd": 0,
  "reason": "manual|bulk|supplier",
  "rounding": "none|0.1|0.5|1",
  "effective_at": 1734048000000
}

2.3 Inventario (solo por movimientos)
StockReceived v1
{
  "movement_id": "uuid",
  "product_id": "uuid",
  "qty": 12,
  "unit_cost_bs": 0,
  "unit_cost_usd": 0,
  "note": "Compra proveedor X",
  "ref": { "supplier": "optional", "invoice": "optional" }
}

StockAdjusted v1
{
  "movement_id": "uuid",
  "product_id": "uuid",
  "qty_delta": -2,
  "reason": "loss|damage|count|other",
  "note": "Se dañaron 2"
}


Para ventas, el descuento se deriva de SaleCreated (o puedes emitir StockSold generado por el caso de uso; recomendado: derivarlo para no duplicar lógica).

2.4 Caja
CashSessionOpened v1
{
  "cash_session_id": "uuid",
  "opened_at": 1734048000000,
  "opening_amount_bs": 0,
  "opening_amount_usd": 0,
  "note": ""
}

CashSessionClosed v1
{
  "cash_session_id": "uuid",
  "closed_at": 1734048000000,
  "expected": {
    "cash_bs": 0,
    "cash_usd": 0,
    "pago_movil_bs": 0,
    "transfer_bs": 0,
    "other_bs": 0
  },
  "counted": {
    "cash_bs": 0,
    "cash_usd": 0,
    "pago_movil_bs": 0,
    "transfer_bs": 0,
    "other_bs": 0
  },
  "note": "Faltó dinero en efectivo"
}

2.5 Ventas
SaleCreated v1
{
  "sale_id": "uuid",
  "cash_session_id": "uuid",
  "sold_at": 1734048000000,
  "exchange_rate": 0,
  "currency": "BS|USD|MIXED",
  "items": [
    {
      "line_id": "uuid",
      "product_id": "uuid",
      "qty": 2,
      "unit_price_bs": 0,
      "unit_price_usd": 0,
      "discount_bs": 0,
      "discount_usd": 0
    }
  ],
  "totals": {
    "subtotal_bs": 0,
    "subtotal_usd": 0,
    "discount_bs": 0,
    "discount_usd": 0,
    "total_bs": 0,
    "total_usd": 0
  },
  "payment": {
    "method": "CASH_BS|CASH_USD|PAGO_MOVIL|TRANSFER|OTHER|SPLIT|FIAO",
    "split": {
      "cash_bs": 0,
      "cash_usd": 0,
      "pago_movil_bs": 0,
      "transfer_bs": 0,
      "other_bs": 0
    }
  },
  "customer": { "customer_id": "uuid|null" },
  "note": ""
}


Reglas:

Si method = FIAO, customer_id obligatorio y se emite/deriva DebtCreated.

Stock se descuenta en proyección usando items[].

2.6 Clientes y Fiao
CustomerCreated v1
{ "customer_id": "uuid", "name": "Juan", "phone": "58...", "note": "" }

CustomerUpdated v1
{ "customer_id": "uuid", "patch": { "name": "?", "phone": "?", "note": "?" } }

DebtCreated v1
{
  "debt_id": "uuid",
  "sale_id": "uuid",
  "customer_id": "uuid",
  "created_at": 1734048000000,
  "amount_bs": 0,
  "amount_usd": 0,
  "note": "Fiado"
}

DebtPaymentRecorded v1
{
  "payment_id": "uuid",
  "debt_id": "uuid",
  "paid_at": 1734048000000,
  "amount_bs": 0,
  "amount_usd": 0,
  "method": "CASH_BS|CASH_USD|PAGO_MOVIL|TRANSFER|OTHER",
  "note": ""
}

3) Sync API definitivo (NestJS + Fastify)
3.1 Endpoint

POST /sync/push

Request DTO
{
  "store_id": "uuid",
  "device_id": "uuid",
  "client_version": "1.0.0",
  "events": [
    { "event_id":"...", "seq":1, "type":"...", "version":1, "created_at":0, "actor":{...}, "payload":{...} }
  ]
}

Response DTO
{
  "accepted": [
    { "event_id": "uuid", "seq": 1 }
  ],
  "rejected": [
    { "event_id": "uuid", "seq": 2, "code": "VALIDATION_ERROR", "message": "..." }
  ],
  "server_time": 1734048000000,
  "last_processed_seq": 123
}

3.2 Reglas del servidor (obligatorias)

Dedupe:

Si event_id ya existe: idempotente (lo marcas como accepted sin reprocesar).

Validación:

store_id/device_id consistentes

tipos conocidos

payload required fields

Proyección:

Tras insertar en events, aplica proyección a read models.

Seguridad:

Auth: token (owner/cashier) asociado a store_id.

4) Esquema de base de datos (server) — SQL completo MVP

Esto funciona bien en Supabase/Postgres. Si luego migras a DB dedicada, es igual.

4.1 Tenancy y usuarios
create table stores (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key, -- user_id
  full_name text,
  created_at timestamptz not null default now()
);

create type store_role as enum ('owner','cashier');

create table store_members (
  store_id uuid references stores(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role store_role not null,
  pin_hash text, -- solo para cashier si quieres
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

4.2 Event store (dedupe)
create table events (
  event_id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  device_id uuid not null,
  seq bigint not null,
  type text not null,
  version int not null,
  created_at timestamptz not null,
  actor_user_id uuid,
  actor_role text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index events_store_seq_idx on events(store_id, seq);
create index events_store_type_idx on events(store_id, type);

4.3 Productos
create table products (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  category text,
  sku text,
  barcode text,
  price_bs numeric(18,2) not null default 0,
  price_usd numeric(18,2) not null default 0,
  cost_bs numeric(18,2) not null default 0,
  cost_usd numeric(18,2) not null default 0,
  low_stock_threshold int not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index products_store_name_idx on products(store_id, name);

4.4 Inventario (movimientos + stock actual como vista/materialización simple)
create table inventory_movements (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  movement_type text not null, -- received|adjust|sold
  qty_delta int not null,
  unit_cost_bs numeric(18,2) not null default 0,
  unit_cost_usd numeric(18,2) not null default 0,
  note text,
  ref jsonb,
  happened_at timestamptz not null
);

create index inv_mov_store_product_idx on inventory_movements(store_id, product_id);


El stock actual lo calculas como sum(qty_delta) por producto. En MVP puedes hacerlo “on the fly” o mantener una tabla product_stock actualizada por proyección.

4.5 Caja
create table cash_sessions (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  opened_by uuid,
  opened_at timestamptz not null,
  opening_amount_bs numeric(18,2) not null default 0,
  opening_amount_usd numeric(18,2) not null default 0,
  closed_by uuid,
  closed_at timestamptz,
  expected jsonb,
  counted jsonb,
  note text
);

create index cash_sessions_store_open_idx on cash_sessions(store_id, opened_at);

4.6 Ventas
create table sales (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  cash_session_id uuid references cash_sessions(id) on delete set null,
  sold_at timestamptz not null,
  exchange_rate numeric(18,6) not null default 0,
  currency text not null,
  totals jsonb not null,
  payment jsonb not null,
  customer_id uuid,
  note text
);

create table sale_items (
  id uuid primary key,
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  qty int not null,
  unit_price_bs numeric(18,2) not null default 0,
  unit_price_usd numeric(18,2) not null default 0,
  discount_bs numeric(18,2) not null default 0,
  discount_usd numeric(18,2) not null default 0
);

create index sales_store_date_idx on sales(store_id, sold_at);

4.7 Clientes + Fiao
create table customers (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  updated_at timestamptz not null default now()
);

create table debts (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null,
  amount_bs numeric(18,2) not null default 0,
  amount_usd numeric(18,2) not null default 0,
  status text not null default 'open'
);

create table debt_payments (
  id uuid primary key,
  store_id uuid not null references stores(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  paid_at timestamptz not null,
  amount_bs numeric(18,2) not null default 0,
  amount_usd numeric(18,2) not null default 0,
  method text not null,
  note text
);

create index debts_store_customer_idx on debts(store_id, customer_id);

5) Proyección: reglas exactas (cómo el servidor aplica eventos)
5.1 Proyección de SaleCreated

Insert en sales

Insert items en sale_items

Insert inventory_movements tipo sold con qty_delta = -qty por cada item

Si payment.method = FIAO:

crear debts (o validar si llega DebtCreated y enlazar)

5.2 Proyección de inventario

StockReceived → movement received qty_delta positivo

StockAdjusted → movement adjust qty_delta +/- según payload

Stock actual = sum(qty_delta) por producto

5.3 Proyección de caja

CashSessionOpened → insert cash_session

CashSessionClosed → update (expected, counted, closed_at)

5.4 Conflictos (MVP)

Precios: si llegan dos PriceChanged, gana el de created_at mayor.

Inventario: no hay “set”; solo movimientos, así evitas conflictos complejos.

Fiao: abonos nunca pueden exceder saldo (validar en servidor).

6) Offline storage (cliente) — SQLite (Desktop) y IndexedDB (PWA)
6.1 SQLite (Desktop) tablas mínimas

local_events (cola de sync)

kv (key/value: store_id, device_id, schema_version, exchange_rate)

read_products

read_stock

read_customers

read_debts

read_cash_session_active

read_sales_day (opcional)

Regla: la UI lee de “read_*” y estos se actualizan aplicando eventos localmente (igual que el server, pero en mini).

6.2 IndexedDB (PWA)

Lo mismo, pero con Dexie stores equivalentes.

7) Estructura del backend (Nest + Fastify) — módulos mínimos
Módulos

AuthModule (si no delegas todo a Supabase)

SyncModule

ProjectionModule

StoresModule (opcional)

ReportsModule (MVP)

Flujo /sync/push

Controller recibe DTO

Service:

valida

dedupe (insert events con ON CONFLICT DO NOTHING)

por cada evento nuevo: ProjectionService.apply(event)

Responde accepted/rejected + last_processed_seq

8) Checklist final de MVP (operativo en tienda)

 ✅ Vender offline sin internet (PWA y Desktop)

 ✅ Inventario: entradas/ajustes/ventas (stock bajo)

 ✅ Caja: apertura/cierre + descuadre (sistema robusto anti-trampas)

 ✅ Fiao: clientes + deuda + abonos + saldo

 ✅ Precios: edición rápida + masivo (con tasa BCV)

 ✅ Sync push: dedupe + reintentos + estado visible

 ✅ Reportes: ventas por día, por pago, top productos, deuda total

 ✅ Export CSV

 ✅ Backup/restore SQLite (Desktop)

 ⭐ Sistema de Efectivo Venezolano (IMPLEMENTADO):
   ✅ Cono monetario 2025
   ✅ Pago en USD físico con cambio en Bs (redondeado)
   ✅ Pago en Bs físico con cambio en Bs (redondeado)
   ✅ Redondeo inteligente (favorece al POS)
   ✅ Desglose de vueltas por denominaciones
   ✅ Mensajes de cortesía para excedentes mínimos
   ✅ Sincronización precisa POS-Caja

 ⏳ Manual + checklist instalación