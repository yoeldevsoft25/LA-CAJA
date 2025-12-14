# Guía de Deploy

## Backend API (Render)

1. Conectar repositorio en Render
2. Configurar:
   - **Runtime**: Node
   - **Build Command**: `cd apps/api && npm install && npm run build`
   - **Start Command**: `cd apps/api && npm run start:prod`
   - **Environment Variables**: Ver `.env.example`

3. Base de datos PostgreSQL:
   - Crear Postgres en Render o usar Supabase
   - Ejecutar migraciones desde `apps/api/src/database/migrations/001_initial_schema.sql`

## PWA Frontend (Vercel/Netlify/Render Static)

1. **Vercel/Netlify**:
   - Conectar repositorio
   - **Build Command**: `cd apps/pwa && npm install && npm run build`
   - **Output Directory**: `apps/pwa/dist`

2. **Render Static**:
   - Similar configuración
   - Output: `apps/pwa/dist`

## Desktop App (Tauri)

### Build para Windows

**Opción 1: Usar el script automático (Recomendado)**

Desde la raíz del proyecto:

```powershell
.\build-desktop.ps1
```

**Opción 2: Compilar manualmente**

```powershell
# 1. Navegar al directorio desktop
cd apps/desktop

# 2. Instalar dependencias (si no están instaladas)
npm install

# 3. Compilar
npm run tauri:build
```

### Ubicación de archivos generados

Después de compilar, encontrarás:

- **Ejecutable**: `apps/desktop/src-tauri/target/release/la-caja-desktop.exe`
- **Instalador NSIS**: `apps/desktop/src-tauri/target/release/bundle/nsis/la-caja-desktop_1.0.0_x64-setup.exe`

### Notas importantes

- La primera compilación puede tardar **10-20 minutos** mientras descarga y compila dependencias de Rust
- Asegúrate de tener **Rust instalado** (`cargo --version`)
- Los iconos se generan automáticamente si no existen
- El instalador NSIS se genera automáticamente para Windows

## Variables de Entorno

### API (.env)

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
```

### Frontend

Configurar `VITE_API_URL` en build time para apuntar al backend desplegado.


