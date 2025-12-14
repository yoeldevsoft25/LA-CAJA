# LA CAJA - Sistema POS Offline-First

Sistema de punto de venta diseñado para funcionar completamente offline, con sincronización de eventos y arquitectura basada en eventos.

## Arquitectura

- **Offline-First**: Todo funciona sin internet
- **Event Log**: Todos los cambios se guardan como eventos localmente
- **Event Ingestion**: Sincronización de eventos al servidor
- **Proyecciones**: Read models optimizados para consultas

## Stack Tecnológico

### Backend
- NestJS + Fastify
- PostgreSQL (Supabase o dedicado)
- Event Store + Read Models

### Frontend
- **PWA**: React + Vite + IndexedDB (Dexie)
- **Desktop**: Tauri + React + SQLite

### Packages
- `packages/domain`: Reglas de negocio puras
- `packages/application`: Casos de uso (orquestación)
- `packages/sync`: Cola, estados, conflict rules

## Estructura del Proyecto

```
la-caja/
├── apps/
│   ├── api/          # NestJS Backend
│   ├── pwa/          # PWA Frontend
│   └── desktop/      # Tauri Desktop App
├── packages/
│   ├── domain/       # Reglas de negocio
│   ├── application/  # Casos de uso
│   └── sync/         # Motor de sincronización
└── roadmap.md        # Roadmap completo
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev:api      # Backend API
npm run dev:pwa      # PWA Frontend
npm run dev:desktop  # Desktop App

# Build
npm run build
```

## Roadmap

Ver [roadmap la caja.md](./roadmap%20la%20caja.md) para el plan completo de 12 sprints.


