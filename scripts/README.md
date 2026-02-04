# Scripts de Utilidad

Este directorio contiene scripts de utilidad para desarrollo, build y testing.

## Scripts de Desarrollo

- `start-dev.sh` - Inicia el entorno de desarrollo completo
- `start-dev-network.ps1` - Inicia servicios de red para desarrollo
- `kill-node.ps1` - Mata procesos de Node.js
- `windows/ferrari-healthcheck.ps1` - Healthcheck integral (API, Docker, Tailscale, WireGuard)
- `windows/ferrari-self-heal.ps1` - Autocuracion de servicios criticos en Windows
- `windows/register-ferrari-tasks.ps1` - Registra tareas programadas para monitoreo y autocuracion

## Scripts de Build

- `build-desktop.ps1` - Construye la aplicación desktop (Tauri)
- `copy-pwa-to-desktop.ps1` - Copia código PWA a desktop

## Scripts de Testing

- `test-api.ps1` - Prueba la conexión a la API
- `test-backend-connection.ps1` - Verifica conexión al backend
- `test-sprint1.ps1` - Tests específicos del Sprint 1

## Scripts de Configuración

- `install-rust.ps1` - Instala Rust (requerido para Tauri)
- `update-env-supabase.ps1` - Actualiza variables de entorno de Supabase

## Scripts SQL

- `test-db.sql` - Scripts de prueba para la base de datos
- `verificar-datos-inmediato.sql` - Verificación de datos

## Uso

### Linux/macOS
```bash
chmod +x *.sh
./start-dev.sh
```

### Windows
```powershell
.\build-desktop.ps1

# Ferrari local (ejecutar como administrador)
.\windows\register-ferrari-tasks.ps1 -ProjectRoot "C:\ruta\LA-CAJA" -RunNow
```
