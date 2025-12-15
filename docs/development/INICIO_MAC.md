# 🚀 Guía de Inicio Rápido - Mac

## Requisitos Previos

### 1. Verificar/Instalar Node.js

```bash
# Verificar si tienes Node.js instalado
node --version

# Si no está instalado, instálalo con Homebrew:
brew install node

# O descarga desde: https://nodejs.org/
# Necesitas Node.js >= 18.0.0
```

### 2. Verificar npm

```bash
npm --version
# Necesitas npm >= 9.0.0
```

### 3. PostgreSQL (Opcional - solo si usas base de datos local)

```bash
# Instalar PostgreSQL con Homebrew
brew install postgresql@15
brew services start postgresql@15

# O usa Supabase (recomendado para desarrollo)
```

## Instalación del Proyecto

### 1. Instalar dependencias

```bash
cd /Users/yoeldev/Documents/GitHub/LA-CAJA
npm install
```

### 2. Configurar variables de entorno (si es necesario)

Si el backend necesita configuración, crea un archivo `.env` en `apps/api/`:

```bash
cd apps/api
touch .env
```

Edita el archivo `.env` con:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/la_caja
JWT_SECRET=tu-secret-key-seguro-aqui
PORT=3000
```

**Nota:** Si usas Supabase, configura la `DATABASE_URL` con tus credenciales de Supabase.

## Iniciar el Proyecto

### Opción 1: Iniciar todo en terminales separadas (Recomendado)

**Terminal 1 - Backend API:**
```bash
cd /Users/yoeldev/Documents/GitHub/LA-CAJA
npm run dev:api
```
El backend estará disponible en: http://localhost:3000

**Terminal 2 - PWA Frontend:**
```bash
cd /Users/yoeldev/Documents/GitHub/LA-CAJA
npm run dev:pwa
```
La PWA estará disponible en: http://localhost:5173

**Terminal 3 - Desktop App (Opcional):**
```bash
cd /Users/yoeldev/Documents/GitHub/LA-CAJA
npm run dev:desktop
```
Se abrirá automáticamente la ventana de Tauri.

### Opción 2: Usar un script de inicio (crear script)

Puedes crear un script `start-dev.sh` para iniciar todo:

```bash
#!/bin/bash

# Iniciar API en background
npm run dev:api &
API_PID=$!

# Iniciar PWA en background
npm run dev:pwa &
PWA_PID=$!

echo "✅ Servicios iniciados:"
echo "   - API: http://localhost:3000 (PID: $API_PID)"
echo "   - PWA: http://localhost:5173 (PID: $PWA_PID)"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"

# Esperar a que el usuario presione Ctrl+C
trap "kill $API_PID $PWA_PID; exit" INT TERM
wait
```

Hacer el script ejecutable:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

## Verificación

Una vez iniciado, verifica que todo funciona:

- **Backend API:** http://localhost:3000
- **PWA Frontend:** http://localhost:5173
- **Health Check:** http://localhost:3000/health (si está configurado)

## Solución de Problemas

### Error: "command not found: node"
```bash
# Instalar Node.js
brew install node
# O descargar desde nodejs.org
```

### Error: "Cannot find module"
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Error de puerto en uso
```bash
# Ver qué proceso usa el puerto 3000
lsof -ti:3000
# Matar el proceso
kill -9 $(lsof -ti:3000)

# O para el puerto 5173
kill -9 $(lsof -ti:5173)
```

### Error de base de datos
- Verifica que PostgreSQL esté corriendo: `brew services list`
- O configura Supabase y actualiza la `DATABASE_URL` en `.env`

## Comandos Útiles

```bash
# Ver logs del backend
npm run dev:api

# Ver logs de la PWA
npm run dev:pwa

# Build de producción
npm run build

# Linter
npm run lint
```

## Próximos Pasos

- Configurar la base de datos (Supabase o local)
- Ejecutar migraciones si es necesario
- Ver el [README.md](./README.md) para más información

