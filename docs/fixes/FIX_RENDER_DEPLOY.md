# Solución al Error de Deploy en Render

## Problema

```
npm error Lifecycle script `start:prod` failed with error:
npm error code 1
npm error path /opt/render/project/src/apps/api
npm error command failed
npm error command sh -c node dist/main
```

## Causa

El proyecto es un **monorepo con npm workspaces**. El build no está generando correctamente el archivo `dist/main.js` porque:

1. Las dependencias necesitan instalarse desde la raíz del proyecto
2. El build debe ejecutarse después de instalar todas las dependencias del workspace

## Solución

### Opción 1: Sin Root Directory (Recomendado)

**Configuración en Render:**

- **Root Directory**: Dejar VACÍO (no configurar `apps/api`)
- **Build Command**: 
  ```
  npm install && cd apps/api && npm run build
  ```
- **Start Command**: 
  ```
  cd apps/api && npm run start:prod
  ```

### Opción 2: Con Root Directory en `apps/api`

**Configuración en Render:**

- **Root Directory**: `apps/api`
- **Build Command**: 
  ```
  cd ../.. && npm install && cd apps/api && npm run build
  ```
- **Start Command**: 
  ```
  npm run start:prod
  ```

## Pasos para Corregir

1. Ve a la configuración de tu servicio en Render
2. Actualiza los comandos según la opción que prefieras (recomiendo Opción 1)
3. Guarda los cambios
4. Render iniciará un nuevo deploy automáticamente

## Verificación

Después del deploy, verifica en los logs que:
- ✅ `npm install` se ejecuta correctamente
- ✅ El build genera archivos en `apps/api/dist/`
- ✅ El comando `start:prod` encuentra el archivo `dist/main.js`

## Comandos Completos para Copiar

### Opción 1 (Recomendada - Sin Root Directory):

**Build Command:**
```bash
npm install && cd apps/api && npm run build
```

**Start Command:**
```bash
cd apps/api && npm run start:prod
```

### Opción 2 (Con Root Directory = `apps/api`):

**Build Command:**
```bash
cd ../.. && npm install && cd apps/api && npm run build
```

**Start Command:**
```bash
npm run start:prod
```

## Notas Adicionales

- Asegúrate de que todas las variables de entorno estén configuradas
- El build puede tardar varios minutos la primera vez
- Si el error persiste, revisa los logs completos del build en Render

