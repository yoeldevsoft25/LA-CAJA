# Reorganización del Repositorio

Este documento describe la reorganización realizada para limpiar y organizar el repositorio.

## Cambios Realizados

### 📁 Nueva Estructura de Directorios

#### `docs/` - Documentación Organizada
- **`deployment/`** - Guías de despliegue (Render, Netlify, etc.)
- **`development/`** - Setup, instalación y guías de desarrollo
- **`fixes/`** - Documentación de correcciones y soluciones
- **`architecture/`** - Arquitectura y diseño del sistema
- **`roadmap/`** - Roadmaps y planificación de sprints

#### `scripts/` - Scripts de Utilidad
- Scripts de desarrollo (`.sh`, `.ps1`)
- Scripts de build
- Scripts de testing
- Scripts SQL

#### `config/` - Archivos de Configuración
- Variables de entorno (`.env`)
- Configuraciones de servicios (Netlify, Vercel, TWA)
- Manifests

#### `assets/` - Assets Compartidos
- Iconos (PNG, SVG)
- Favicons
- Imágenes compartidas

### Archivos Movidos

#### Documentación (60+ archivos .md)
- Todos los archivos `.md` de la raíz fueron organizados en `docs/` por categoría
- Archivos de documentación dentro de `apps/` también fueron movidos a `docs/`

#### Scripts
- Todos los scripts `.ps1` y `.sh` de la raíz → `scripts/`
- Scripts SQL de prueba → `scripts/`

#### Configuración
- Archivos `.env` → `config/`
- `netlify.toml`, `vercel.json`, `twa-manifest.json` → `config/`

#### Assets
- Iconos y favicons de la raíz → `assets/`

### Archivos que NO Deben Versionarse

Los siguientes archivos están en `.gitignore` y no deberían estar en el repositorio:
- `android.keystore` - Keystore de Android (sensible)
- `app-release-*.apk` - APKs de build
- `app-release-*.aab` - AABs de build
- `app/` - Proyecto generado por Bubblewrap
- `build/` - Directorio de build de Gradle

### Actualizaciones

- ✅ `.gitignore` actualizado para incluir más patrones de archivos de build
- ✅ `README.md` actualizado con la nueva estructura
- ✅ `docs/README.md` creado como índice de documentación
- ✅ `scripts/README.md` creado para documentar los scripts

## Próximos Pasos Recomendados

1. **Limpiar archivos de build**: Eliminar manualmente los APKs, AABs y el keystore del repositorio (ya están en `.gitignore`)
2. **Revisar referencias**: Actualizar cualquier referencia a rutas antiguas en el código
3. **Commit**: Hacer commit de los cambios de reorganización

## Estructura Final

```
la-caja/
├── apps/              # Aplicaciones (api, pwa, desktop)
├── packages/          # Paquetes compartidos
├── docs/              # 📚 Documentación organizada
│   ├── deployment/
│   ├── development/
│   ├── fixes/
│   ├── architecture/
│   └── roadmap/
├── scripts/           # 🛠️ Scripts de utilidad
├── config/            # ⚙️ Archivos de configuración
├── assets/            # 🎨 Assets compartidos
├── README.md          # Documentación principal
└── .gitignore         # Archivos ignorados
```

