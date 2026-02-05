# Velox POS (La Caja)

ERP + POS offline-first con sincronizacion por eventos. Diseñado para vender siempre: sin internet, con reconcilio automatico y proyecciones en background.

## Lo esencial
- **Offline-first real**: ventas, stock y caja funcionan sin red.
- **Sync por eventos**: cola local + vector clocks + reconciliacion.
- **Multicanal**: PWA, Desktop (Tauri) y Android/TWA.
- **Proyecciones asincronas**: BullMQ procesa ventas, inventario y reportes.
- **Federacion**: replica entre servidor central y nodos locales.

## Arquitectura operacional (cerebro Velox POS)

```mermaid
flowchart LR
  subgraph Clients["Clientes"]
    PWA[PWA]
    Desktop[Desktop Tauri]
    Android[Android/TWA]
  end

  subgraph LocalCore["Offline Core - Device"]
    LocalDB["IndexedDB - SQLite"]
    LocalQ[Local Event Queue]
    VC[Vector Clocks]
    BG[Background Sync]
  end

  subgraph SyncClient["Sync Engine - Client"]
    Push[Push Events]
    Pull[Pull Changes]
    Reconcile[Reconcile + Merge]
  end

  subgraph API["Backend API - NestJS"]
    Auth[Auth + License]
    Sync[Sync Ingress]
    Federation[Federation Relay]
    Realtime[WebSockets]
  end

  subgraph EventCore["Event Core"]
    EventStore[Event Store]
    CRDT[CRDT + Conflict Resolver]
  end

  subgraph Queues["BullMQ - Redis"]
    QProj[sales-projections]
    QPost[sales-post-processing]
    QNotif[notifications]
    QFed[federation-sync]
  end

  subgraph Projections["Read Models"]
    SalesRM[Sales]
    InvRM[Inventory]
    CashRM[Cash Payments]
    CustRM[Customers Debts]
    ReportsRM[Reports Analytics]
  end

  subgraph Data["Datastore"]
    DB[(PostgreSQL Supabase)]
  end

  subgraph Ops["Observabilidad"]
    Metrics[Metrics]
    Logs[Logs]
  end

  subgraph Integrations["Integraciones"]
    Email[Email]
    WhatsApp[WhatsApp]
    Fiscal[Fiscal Invoice]
  end

  PWA --> LocalDB
  Desktop --> LocalDB
  Android --> LocalDB
  LocalDB --> LocalQ --> VC --> BG
  BG --> SyncClient
  SyncClient --> Push --> Sync
  Sync --> Pull --> SyncClient
  Reconcile --> LocalDB

  Sync --> EventStore --> CRDT --> EventStore
  EventStore --> Queues
  Queues --> Projections --> DB

  Sync --> Federation --> QFed
  Sync --> Realtime --> Clients

  QPost --> Fiscal
  QNotif --> Email
  QNotif --> WhatsApp

  API --> Metrics
  API --> Logs
```

## Subflujos operativos (detalle real)

```mermaid
flowchart TD
  subgraph Client["Cliente Offline First"]
    UI[POS UI]
    LocalDB["Local DB"]
    LocalQ["Local Event Queue"]
  end

  subgraph SyncEngine["Sync Engine"]
    Detect[Detect Online]
    Push[Push Events]
    Pull[Pull Changes]
    Merge[Reconcile Merge]
  end

  subgraph API["Backend API"]
    Ingress["Sync Ingress"]
    EventStore["Event Store"]
    Relay["Federation Relay"]
  end

  subgraph Queues["BullMQ"]
    QProj["sales-projections"]
    QPost["sales-post-processing"]
    QNotif["notifications"]
    QFed["federation-sync"]
  end

  subgraph Projections["Read Models"]
    SalesRM["Sales"]
    InvRM["Inventory"]
    CashRM["Cash Payments"]
    DebtRM["Debts"]
    ReportsRM["Reports"]
  end

  subgraph SideEffects["Side Effects"]
    Fiscal["Fiscal Invoice"]
    Accounting["Accounting Entries"]
    Email["Email"]
    WhatsApp["WhatsApp"]
  end

  subgraph DB["PostgreSQL Supabase"]
    Data[(Data)]
  end

  UI --> LocalDB --> LocalQ
  LocalQ --> Detect
  Detect -->|online| Push --> Ingress
  Detect -->|offline| LocalQ
  Ingress --> EventStore
  EventStore --> QProj
  EventStore --> Relay --> QFed
  QProj --> Projections --> Data
  Projections --> QPost --> Fiscal
  QPost --> Accounting
  QNotif --> Email
  QNotif --> WhatsApp
  Pull --> Merge --> LocalDB

  Ingress --> Pull
```

## Componentes principales
- **API**: `apps/api` (NestJS + Fastify)
- **PWA**: `apps/pwa` (React + Vite + Dexie)
- **Desktop**: `apps/desktop` (Tauri + React + SQLite)
- **Shared**: `packages/domain`, `packages/sync`, `packages/offline-core`, `packages/api-client`, `packages/ui-core`, `packages/app-core`

## Flujo operativo (resumen)
1. El cliente crea eventos locales (ventas, stock, caja).
2. Se encolan y sincronizan cuando hay conectividad.
3. El API ingiere eventos y los guarda en el Event Store.
4. BullMQ proyecta a read models y genera reportes/side-effects.
5. La federacion replica entre nodos (local <-> central).

## Estructura del repo
```
LA-CAJA/
├── apps/
│   ├── api/          # Backend NestJS
│   ├── pwa/          # PWA offline-first
│   └── desktop/      # Desktop Tauri
├── packages/
│   ├── domain/       # Dominio y eventos
│   ├── sync/         # Motor de sync
│   ├── offline-core/ # Queue + storage + vector clocks
│   ├── api-client/   # Cliente HTTP tipado
│   ├── ui-core/      # UI shared
│   └── app-core/     # Stores y hooks base
├── docs/
├── scripts/
└── .github/workflows/
```

## Desarrollo
```bash
npm install
npm run dev:api
npm run dev:pwa
npm run dev:desktop
```

## Documentacion
- Indice: `docs/README.md`
- Mapa de sistema: `docs/architecture/VELOX_SYSTEM_MAP.md`
- Arquitectura offline: `docs/architecture/ARQUITECTURA_OFFLINE_ROBUSTA.md`
- Roadmap: `docs/roadmap/roadmap la caja.md`
