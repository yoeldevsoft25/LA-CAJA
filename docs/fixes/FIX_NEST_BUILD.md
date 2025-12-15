# Solución: nest: not found

## Problema

```
sh: 1: nest: not found
npm error Lifecycle script `build` failed with error
```

## Causa

El comando `nest` (NestJS CLI) está en `devDependencies` y no se instala por defecto en producción. Render ejecuta `npm install` sin las devDependencies.

## Solución

Actualiza el **Build Command** en Render para incluir las devDependencies:

### Opción 1: Sin Root Directory (Recomendado)

**Build Command:**
```bash
npm install --include=dev && cd apps/api && npm run build
```

**Start Command:**
```bash
cd apps/api && npm run start:prod
```

### Opción 2: Con Root Directory = `apps/api`

**Build Command:**
```bash
cd ../.. && npm install --include=dev && cd apps/api && npm run build
```

**Start Command:**
```bash
npm run start:prod
```

## Explicación

- `--include=dev` instala las `devDependencies` que son necesarias para compilar
- `@nestjs/cli` está en `devDependencies` y se necesita para ejecutar `nest build`
- En producción, solo se ejecuta el código compilado (`dist/main.js`), no se necesita el CLI

## Pasos

1. Ve a la configuración de tu servicio en Render
2. Actualiza el **Build Command** con `--include=dev`
3. Guarda los cambios
4. Render iniciará un nuevo deploy automáticamente

