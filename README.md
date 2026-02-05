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

## Subflujo: federacion y auto-reconcile

```mermaid
flowchart LR
  subgraph LocalNode["Nodo Local"]
    LocalEvents["Eventos Locales"]
    LocalQueue["Queue Federation"]
    LocalAPI["API Local"]
  end

  subgraph Central["Servidor Central"]
    CentralAPI["API Central"]
    CentralEvents["Event Store Central"]
    CentralQueue["Queue Federation"]
  end

  subgraph Heal["Auto Reconcile"]
    Diff["Diff IDs"]
    Replay["Replay Missing"]
    HealStock["Heal Inventory Stock"]
  end

  LocalEvents --> LocalAPI --> LocalQueue
  LocalQueue --> CentralAPI --> CentralEvents
  CentralEvents --> CentralQueue --> LocalAPI

  CentralAPI --> Diff --> Replay --> LocalAPI
  LocalAPI --> Diff --> Replay --> CentralAPI
  Diff --> HealStock
```

## Subflujo: inventario end to end

```mermaid
flowchart TD
  subgraph Client["Cliente"]
    UIInv["Inventory UI"]
    LocalDB["Local DB"]
    LocalQ["Local Event Queue"]
  end

  subgraph Sync["Sync Engine"]
    Push["Push Events"]
    Pull["Pull Changes"]
    Merge["Reconcile Merge"]
  end

  subgraph API["Backend API"]
    Ingress["Sync Ingress"]
    EventStore["Event Store"]
  end

  subgraph Queues["BullMQ"]
    QProj["sales-projections"]
  end

  subgraph Projections["Read Models"]
    InvRM["Inventory Projection"]
  end

  subgraph DB["PostgreSQL Supabase"]
    Data[(Data)]
  end

  UIInv --> LocalDB --> LocalQ --> Push --> Ingress --> EventStore --> QProj
  QProj --> InvRM --> Data
  EventStore --> Pull --> Merge --> LocalDB
```

## Subflujo: ventas offline end to end

```mermaid
flowchart TD
  subgraph Client["Cliente POS"]
    UI["POS UI"]
    LocalDB["Local DB"]
    LocalQ["Local Event Queue"]
  end

  subgraph Sync["Sync Engine"]
    Push["Push Events"]
    Pull["Pull Changes"]
    Merge["Reconcile Merge"]
  end

  subgraph API["Backend API"]
    Ingress["Sync Ingress"]
    EventStore["Event Store"]
    Auth["Auth + License"]
  end

  subgraph Queues["BullMQ"]
    QProj["sales-projections"]
    QPost["sales-post-processing"]
  end

  subgraph Projections["Read Models"]
    SalesRM["Sales Projection"]
    CashRM["Cash Payments Projection"]
    DebtRM["Debts Projection"]
  end

  subgraph SideEffects["Side Effects"]
    Fiscal["Fiscal Invoice"]
    Accounting["Accounting Entry"]
  end

  subgraph DB["PostgreSQL Supabase"]
    Data[(Data)]
  end

  UI --> LocalDB --> LocalQ --> Push --> Auth --> Ingress --> EventStore
  EventStore --> QProj --> SalesRM --> Data
  SalesRM --> CashRM --> Data
  SalesRM --> DebtRM --> Data
  EventStore --> QPost --> Fiscal
  QPost --> Accounting
  EventStore --> Pull --> Merge --> LocalDB
```

## Subflujo: colas BullMQ y proyecciones

```mermaid
flowchart LR
  subgraph Producers["Producers"]
    Sync["SyncService.push"]
    CreateSale["CreateSaleHandler"]
    Notif["Notification Orchestrator"]
    Federation["FederationSyncService"]
  end

  subgraph Queues["BullMQ"]
    QProj["sales-projections"]
    QPost["sales-post-processing"]
    QNotif["notifications"]
    QFed["federation-sync"]
  end

  subgraph Workers["Workers"]
    ProjWorker["SalesProjectionQueueProcessor"]
    PostWorker["SalesPostProcessingQueueProcessor"]
    NotifWorker["NotificationsQueueProcessor"]
    FedWorker["FederationSyncProcessor"]
  end

  subgraph Outputs["Outputs"]
    Projections["Read Models"]
    Fiscal["Fiscal Invoice"]
    Accounting["Accounting Entry"]
    Email["Email"]
    WhatsApp["WhatsApp"]
    Remote["Remote Relay"]
  end

  Sync --> QProj --> ProjWorker --> Projections
  CreateSale --> QPost --> PostWorker --> Fiscal
  PostWorker --> Accounting
  Notif --> QNotif --> NotifWorker --> Email
  NotifWorker --> WhatsApp
  Federation --> QFed --> FedWorker --> Remote
```

## Subflujo: seguridad y licencias

```mermaid
flowchart LR
  subgraph Client["Cliente"]
    Login["Login"]
    Token["JWT"]
  end

  subgraph API["Backend API"]
    Auth["Auth Service"]
    License["License Service"]
    Policy["Policy Gate"]
  end

  subgraph Data["Data"]
    Users["Users"]
    Stores["Stores"]
    Plans["License Plans"]
    Usage["License Usage"]
  end

  Login --> Auth --> Token
  Token --> Policy --> License
  Auth --> Users
  Auth --> Stores
  License --> Plans
  License --> Usage
```

## Subflujo: datos y proyecciones

```mermaid
flowchart LR
  subgraph Events["Events"]
    EventStore["Event Store"]
  end

  subgraph Queues["BullMQ"]
    QProj["sales-projections"]
  end

  subgraph Projections["Read Models"]
    SalesRM["Sales"]
    InvRM["Inventory"]
    CashRM["Cash Payments"]
    DebtRM["Debts"]
    ReportsRM["Reports Analytics"]
  end

  subgraph DB["PostgreSQL Supabase"]
    Data[(Data)]
  end

  EventStore --> QProj --> SalesRM --> Data
  SalesRM --> InvRM --> Data
  SalesRM --> CashRM --> Data
  SalesRM --> DebtRM --> Data
  Data --> ReportsRM
```

## Leyenda (rapida)
- **Event Store**: fuente de verdad operativa.
- **Queues**: procesamiento asincrono y backpressure.
- **Read Models**: vistas optimizadas para UI y reportes.
- **Federation**: replica y autoreconcile entre nodos.

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

## Inmersión Profunda: El Cerebro Velox

Esta sección detalla los mecanismos internos que garantizan la consistencia y disponibilidad del sistema ("The Velox Brain").

### 1. Motor de Sincronización (Sync Engine Internals)

El motor utiliza un sistema de **doble persistencia** (IndexedDB + Memoria) con un mecanismo de "Hard Recovery" para garantizar que ningún evento se pierda, incluso si la aplicación se cierra inesperadamente o el navegador decide eliminar la memoria de la pestaña.

```mermaid
flowchart TD
    subgraph Input["Input Event"]
        NewEvent[New Event]
    end

    subgraph Atomic["Atomic Sequence"]
        Seq[Allocate Seq + Vector Clock]
    end

    subgraph Persistence["Persistence Layer"]
        IDB[(IndexedDB)]
    end

    subgraph Memory["Memory Queue"]
        Queue[Sync Queue]
        Batch[Batch Buffer]
    end

    subgraph Network["Network Layer"]
        Flush[Flush Batch]
        API[Backend API]
    end

    subgraph Recovery["Hard Recovery Loop"]
        Online[Connectivity / Focus] -->|Trigger| Lock{Mutex Lock}
        Lock -->|Acquired| Scan[Scan IndexedDB]
        Scan -->|Reconcile| Rebuild[Rebuild Memory Queue]
        Rebuild -->|Force| Flush
    end

    NewEvent --> Atomic
    Atomic -->|1. Persist First| IDB
    IDB -->|2. Enqueue| Queue
    Queue -->|3. Buffer| Batch
    Batch -->|Time/Size Limit| Flush
    Flush -->|HTTP POST| API

    API -->|200 OK| Ack[Mark Synced in IDB]
    API -->|Error| Retry[Retry Strategy (Exp. Backoff)]
    Retry --> Batch
```

### 2. Resolución de Conflictos (CRDTs Decision Flow)

Cuando el servidor recibe eventos concurrentes (detectados vía Vector Clocks), el `ConflictResolutionService` decide automáticamente la estrategia de convergencia basada en el tipo de dato.

```mermaid
flowchart TD
    Start[Evento Entrante B] --> Detect{¿Misma Entidad?}
    Detect -->|No| NoConflict[Sin Conflicto]
    Detect -->|Si| VC[Comparar Vector Clocks]

    VC -->|A < B| Apply[Aplicar B (Nuevo)]
    VC -->|A > B| Ignore[Ignorar B (Obsoleto)]
    VC -->|Concurrent A || B| Strategy{Estrategia?}

    subgraph Strategies["Estrategias CRDT"]
        LWW[LWW (Last-Write-Wins)]
        AWSet[AWSet (Add-Wins Set)]
        MVR[MVR (Multi-Value Register)]
    end

    Strategy -->|Simple Fields| LWW
    Strategy -->|Lists/Inv| AWSet
    Strategy -->|Critical $| MVR

    LWW --> TieBr{Tie Breaker}
    TieBr -->|Max Timestamp| WinnerLWW[Ganador LWW]
    TieBr -->|Device ID| WinnerLWW

    AWSet --> Union[Union Adds - Removes]
    Union --> ResultAW[Lista Convergente]

    MVR --> Manual[Conflicto Manual]
     Manual --> Human{Revisión Humana}
```

### 3. Queue Consistency & Anti-Storm

Para evitar "tormentas" de sincronización y estados inconsistentes ("fantasmas"), el sistema implementa un monitor de consistencia que reconcilia la verdad del disco con la memoria.

```mermaid
flowchart LR
    subgraph Truth["Source of Truth (Disk)"]
        DB_Events[IndexedDB Events]
    end

    subgraph State["AppState (Memory)"]
        Mem_Queue[Memory Queue]
    end

    subgraph Watchdog["Consistency Watchdog"]
        Check{Count Mismatch?}
        Reconcile[Reconcile Logic]
    end

    subgraph AntiStorm["Anti-Storm"]
        Debounce[Debounce 500ms]
        Cooldown[Cooldown 8s]
        Mutex[Global Mutex]
    end

    DB_Events -.->|Load on Init| Mem_Queue
    
    Trigger[Event/Timer] --> AntiStorm
    AntiStorm --> Watchdog

    Watchdog --> Check
    Check -->|DB != Mem| Reconcile
    Reconcile -->|Fix| Mem_Queue
    
    Reconcile -->|Phantom Pending| Clear[Clear Phantom]
    Reconcile -->|Missing InMemory| Load[Load from DB]
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
