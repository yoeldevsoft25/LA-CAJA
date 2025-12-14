-- 4.1 Tenancy y usuarios
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

-- 4.2 Event store (dedupe)
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

-- 4.3 Productos
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

-- 4.4 Inventario (movimientos)
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

-- 4.5 Caja
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

-- 4.6 Ventas
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

-- 4.7 Clientes + Fiao
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


