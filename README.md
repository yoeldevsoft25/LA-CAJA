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

El motor utiliza un sistema de **doble persistencia** (IndexedDB + Memoria) con un mecanismo de "Hard Recovery" para garantizar que ningún evento se pierda.

```mermaid
flowchart TD
    subgraph Input["Entrada de Evento"]
        NewEvent[Nuevo Evento]
    end

    subgraph Atomic["Secuencia Atómica"]
        Seq[Asignar Seq + Vector Clock]
    end

    subgraph Persistence["Capa de Persistencia"]
        IDB[(IndexedDB)]
    end

    subgraph Memory["Cola en Memoria"]
        Queue[Cola de Sync]
        Batch[Batch Buffer]
    end

    subgraph Network["Capa de Red"]
        Flush[Enviar Batch]
        API[Backend API]
    end

    subgraph Recovery["Ciclo de Hard Recovery"]
        Online[Conexión / Foco] -->|Disparar| Lock{Mutex Lock}
        Lock -->|Adquirido| Scan[Escanear IndexedDB]
        Scan -->|Reconciliar| Rebuild[Reconstruir Cola Memoria]
        Rebuild -->|Forzar| Flush
    end

    NewEvent --> Atomic
    Atomic -->|1. Persistir Primero| IDB
    IDB -->|2. Encolar| Queue
    Queue -->|3. Buffer| Batch
    Batch -->|Limite Tiempo/Tamaño| Flush
    Flush -->|HTTP POST| API

    API -->|200 OK| Ack[Marcar Sincronizado en IDB]
    API -->|Error| Retry["Estrategia Retry (Exp. Backoff)"]
    Retry --> Batch
```

### 2. Resolución de Conflictos (Flujo de Decisión CRDT)

Cuando el servidor recibe eventos concurrentes, decide automáticamente la estrategia de convergencia.

```mermaid
flowchart TD
    Start["Evento Entrante B"] --> Detect{¿Misma Entidad?}
    Detect -->|No| NoConflict[Sin Conflicto]
    Detect -->|Si| VC[Comparar Vector Clocks]

    VC -->|"A < B"| Apply["Aplicar B (Nuevo)"]
    VC -->|"A > B"| Ignore["Ignorar B (Obsoleto)"]
    VC -->|"Concurrente A || B"| Strategy{"Estrategia?"}

    subgraph Strategies["Estrategias CRDT"]
        LWW["LWW (Ultima-Escritura-Gana)"]
        AWSet["AWSet (Set Agrega-Gana)"]
        MVR["MVR (Registro Multi-Valor)"]
    end

    Strategy -->|Campos Simples| LWW
    Strategy -->|Listas/Inv| AWSet
    Strategy -->|Crítico $| MVR

    LWW --> TieBr{Desempate}
    TieBr -->|"Max Timestamp"| WinnerLWW["Ganador LWW"]
    TieBr -->|"Device ID"| WinnerLWW

    AWSet --> Union["Unión Agrega - Remueve"]
    Union --> ResultAW["Lista Convergente"]

    MVR --> Manual["Conflicto Manual"]
    Manual --> Human{"Revisión Humana"}
```

### 3. Consistencia de Cola y Anti-Tormenta (Queue Consistency)

Evita "tormentas" de sincronización y estados inconsistentes ("fantasmas").

```mermaid
flowchart LR
    subgraph Truth["Fuente de Verdad (Disco)"]
        DB_Events["Eventos IndexedDB"]
    end

    subgraph State["Estado App (Memoria)"]
        Mem_Queue["Cola en Memoria"]
    end

    subgraph Watchdog["Vigilante de Consistencia"]
        Check{"¿Diferencia Conteo?"}
        Reconcile["Lógica Reconciliación"]
    end

    subgraph AntiStorm["Anti-Tormenta"]
        Debounce["Debounce 500ms"]
        Cooldown["Enfriamiento 8s"]
        Mutex["Mutex Global"]
    end

    DB_Events -.->|"Carga al Inicio"| Mem_Queue
    
    Trigger["Evento/Timer"] --> AntiStorm
    AntiStorm --> Watchdog

    Watchdog --> Check
    Check -->|"DB != Mem"| Reconcile
    Reconcile -->|Corregir| Mem_Queue
    
    Reconcile -->|"Pendiente Fantasma"| Clear["Limpiar Fantasma"]
    Reconcile -->|"Falta en Memoria"| Load["Cargar de DB"]
```

### 4. Federación Multi-Nodo (Smart Auto-Heal)

Sincronización robusta entre nodo local y central, capaz de autoreparar brechas de datos.

```mermaid
flowchart TD
    subgraph Trigger["Disparador"]
        Cron["Cron / Smart Heal"] -->|"Detecta Brecha"| AutoHeal
    end

    subgraph Reconcile["Lógica de Auto-Reconciliación"]
        AutoHeal["Run Auto-Reconcile"]
        FetchRemote["Obtener IDs Remotos"]
        FetchLocal["Obtener IDs Locales"]
        Diff{"Calcular Diff"}
    end

    subgraph Actions["Acciones de Reparación"]
        ReplayRemote["Replay a Remoto"]
        ReplayLocal["Replay a Local"]
        HealStock["Corregir Stock"]
    end

    subgraph Queue["Cola de Federación"]
        JobRelay["Job: relay-event"]
        Worker["Federation Processor"]
    end

    AutoHeal --> FetchRemote & FetchLocal
    FetchRemote & FetchLocal --> Diff
    
    Diff -->|"Falta en Remoto"| ReplayRemote
    Diff -->|"Falta en Local"| ReplayLocal
    
    ReplayRemote -->|Encolar| JobRelay
    JobRelay --> Worker -->|"HTTP POST"| CentralAPI["API Central"]
    
    Diff -->|"Inconsistencia Stock"| HealStock
```

### 5. Procesamiento Asíncrono (Backend Pipeline)

Pipeline de procesamiento de eventos de ventas para mantener la respuesta al cliente por debajo de 50ms.

```mermaid
flowchart TD
    subgraph Ingress["Ingreso API"]
        EventCreated["Evento SaleCreated"]
    end

    subgraph Q1["Cola: sales-projections"]
        WorkerProj["Worker Proyecciones"]
        Completeness{"¿Venta Completa?"}
        Project["Proyectar a Read Model"]
    end

    subgraph Q2["Cola: sales-post-processing"]
        WorkerPost["Worker Post-Proceso"]
        Fiscal["Facturación Fiscal"]
        Accounting["Asiento Contable"]
    end

    EventCreated -->|"1. Encolar"| Q1
    
    Q1 --> WorkerProj
    WorkerProj --> Completeness
    
    Completeness -->|Si| Project
    Completeness -->|No| Retry["Reintentar luego"]
    
    Project -->|Exito| Q2
    
    Q2 --> WorkerPost
    WorkerPost -->|Opcional| Fiscal
    Fiscal -->|Emitida| Accounting
    WorkerPost -->|"Sin Fiscal"| Accounting
```

## Desarrollo
```bash
npm ci
npm run dev:api
npm run dev:pwa
npm run dev:desktop
```

**Entorno y CI local:** Requisitos (Node 20, `npm ci`), script `./scripts/check-env.sh` y pasos para verificar builds/tests/lint como en CI: [docs/development/ENTORNO_LOCAL.md](docs/development/ENTORNO_LOCAL.md).

### 6. Integraciones Futuras / Roadmap

Arquitectura planeada para subsistemas en desarrollo activo.

#### 6.1. Capa de Hardware Híbrida (Print & Peripherals)
Modelo de abstracción para manejar impresión nativa (Desktop) y web (PWA).

```mermaid
flowchart TD
    subgraph App["Velox Client"]
        PrintService["PrintService"]
        PeriService["PeripheralsService"]
    end

    subgraph Config["Configuración"]
        DB_Config["IndexedDB: Configs"]
        Default["Default: Browser API"]
    end

    subgraph Drivers["Drivers / Puentes"]
        Browser["Navegador (Window.print)"]
        Serial["Web Serial API"]
        Bridge["Tauri Rust Bridge"]
        Net["Network / ESC-POS"]
    end

    subgraph Hardware["Hardware Físico"]
        Thermal["Impresora Térmica"]
        Scanner["Lector Barcode"]
        Scale["Balanza"]
    end

    PeriService -->|"1. Cargar Config"| DB_Config
    PrintService -->|"2. Resolver Driver"| PeriService
    
    PeriService -->|Default| Browser
    PeriService -->|"USB Direct"| Serial
    PeriService -->|Nativo| Bridge
    PeriService -->|LAN| Net

    Browser -.->|"OS Dialog"| Thermal
    Serial -->|"Raw Bytes"| Thermal
    Bridge -->|"Rust SerialPort"| Scanner & Scale
    Net -->|"TCP/IP"| Thermal
```

#### 6.2. Autenticación Offline (Credenciales Distribuidas)
Mecanismo de "Replica de Credenciales" para permitir login sin internet.

```mermaid
flowchart TD
    subgraph Online["Fase Online (Sync)"]
        Login["Login Exitoso"]
        SyncCreds["Sincronizar Hash PIN"]
        SaveCreds["Guardar en IDB Seguro"]
    end

    subgraph Offline["Fase Offline (Login)"]
        Input["Input PIN"]
        Hash["Hashing Local (Argon2/SHA)"]
        Compare{"¿Coincide Hash?"}
        Session["Crear Sesión Local"]
    end

    subgraph Security["Seguridad"]
        Salt["Salt Específico Dispositivo"]
        TTL["Expiración Token Offline"]
    end

    Login -->|"Token + Hash"| SyncCreds
    SyncCreds -->|Encriptado| SaveCreds
    
    Input --> Hash
    SaveCreds -.->|Leer| Compare
    Hash --> Compare
    
    Compare -->|Si| Session
    Compare -->|No| Error["PIN Inválido"]
    
    Session -->|Validar| TTL
```


## Documentacion
- Indice: `docs/README.md`
- Mapa de sistema: `docs/architecture/VELOX_SYSTEM_MAP.md`
- Arquitectura offline: `docs/architecture/ARQUITECTURA_OFFLINE_ROBUSTA.md`
- Matriz de trazabilidad (README vs codigo): `docs/architecture/VELOX_TRACEABILITY_MATRIX.md`
- Roadmap: `docs/roadmap/roadmap la caja.md`
