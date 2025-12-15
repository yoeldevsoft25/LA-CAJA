# Notas de Desarrollo

## SQLite en Desktop (Tauri)

Para la app desktop, SQLite se implementará usando una de estas opciones:

1. **Tauri SQL Plugin** (recomendado para Sprint 3+):
   - Plugin oficial de Tauri para SQLite
   - No requiere dependencias nativas de Node.js
   - Más integrado con Tauri

2. **sql.js** (alternativa):
   - SQLite compilado a WebAssembly
   - Funciona en cualquier entorno que soporte WebAssembly
   - No requiere compilación nativa

3. **better-sqlite3** (no recomendado inicialmente):
   - Requiere Visual Studio Build Tools en Windows
   - Requiere compilación nativa
   - Más complicado para desarrollo inicial

Para el Sprint 0, la app desktop funciona sin SQLite. Se implementará cuando sea necesario (Sprint 3+).

## Dependencias opcionales

Si necesitas `better-sqlite3` más adelante, puedes instalarlo localmente:

```bash
cd apps/desktop
npm install better-sqlite3 --save-optional
```

Pero primero necesitas instalar Visual Studio Build Tools:
- Descargar desde: https://visualstudio.microsoft.com/downloads/
- Instalar "Desktop development with C++" workload


