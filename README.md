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
├── docs/             # Documentación organizada
│   ├── deployment/   # Guías de despliegue
│   ├── development/  # Setup y desarrollo
│   ├── fixes/        # Soluciones a problemas
│   ├── architecture/ # Arquitectura del sistema
│   └── roadmap/      # Roadmaps y sprints
├── scripts/          # Scripts de utilidad
├── config/           # Archivos de configuración
└── assets/           # Assets compartidos
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

## Documentación

Toda la documentación está organizada en el directorio [`docs/`](./docs/). Ver el [índice de documentación](./docs/README.md) para una guía completa.

### Guías Rápidas
- 📖 [Instalación](./docs/development/INSTALL.md)
- 🚀 [Despliegue](./docs/deployment/DEPLOY.md)
- 🧭 [Mapa del Sistema (Velox POS)](./docs/architecture/VELOX_SYSTEM_MAP.md)
- 🏗️ [Arquitectura Offline-First](./docs/architecture/ARQUITECTURA_OFFLINE_ROBUSTA.md)
- 🗺️ [Roadmap](./docs/roadmap/roadmap%20la%20caja.md)

## Scripts

Scripts de utilidad disponibles en [`scripts/`](./scripts/):
- `start-dev.sh` - Iniciar entorno de desarrollo
- `build-desktop.ps1` - Build de la app desktop
- `test-api.ps1` - Tests de la API


