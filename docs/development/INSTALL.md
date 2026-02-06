# Guía de Instalación - LA CAJA

**Requisitos detallados y verificación de entorno:** [ENTORNO_LOCAL.md](./ENTORNO_LOCAL.md).

## Requisitos Previos

- Node.js 20.x (recomendado; ver `.nvmrc`)
- npm >= 9.0.0
- PostgreSQL (para desarrollo local) o cuenta de Supabase
- **Rust (para compilar Tauri Desktop)** - Solo si quieres buildear desktop
  - **Instalación rápida en Windows:**
    ```powershell
    # Opción 1: Usar el script incluido
    .\install-rust.ps1
    
    # Opción 2: Descargar manualmente desde https://rustup.rs/
    # Descarga rustup-init.exe y ejecútalo
    ```
  - Después de instalar, **cierra y vuelve a abrir PowerShell** para que se actualice el PATH
  - Verificar instalación: `cargo --version`
- Visual Studio Build Tools (solo si quieres compilar dependencias nativas) - No necesario para Sprint 0

## Instalación

### 1. Instalar dependencias

Desde la raíz del repo (recomendado para CI y entornos reproducibles):

```bash
npm ci
```

Opcional antes: `./scripts/check-env.sh` para verificar Node. Ver [ENTORNO_LOCAL.md](./ENTORNO_LOCAL.md).

### 2. Configurar Backend

```bash
cd apps/api
cp .env.example .env
```

Editar `.env` con tus credenciales de base de datos:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/la_caja
JWT_SECRET=tu-secret-key-seguro
```

### 3. Ejecutar Migraciones SQL

Conectarse a PostgreSQL y ejecutar:

```bash
psql -U user -d la_caja -f src/database/migrations/001_initial_schema.sql
```

O si usas Supabase, ejecutar el SQL desde el dashboard.

### 4. Ejecutar en Desarrollo

Terminal 1 - Backend:
```bash
npm run dev:api
```

Terminal 2 - PWA:
```bash
npm run dev:pwa
```

Terminal 3 - Desktop (opcional):
```bash
npm run dev:desktop
```

## Verificación

- Backend: http://localhost:3000/health
- PWA: http://localhost:5173
- Desktop: Se abrirá automáticamente la ventana de Tauri

## Próximos Pasos

Ver el [roadmap](./roadmap%20la%20caja.md) para continuar con el Sprint 1.

