# 🧪 Instalación de Testing Automatizado

## Paso 1: Instalar Dependencias

```bash
cd apps/pwa

# Dependencias de Vitest (unit/integración)
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom happy-dom @vitest/coverage-v8

# Dependencias de Playwright (E2E)
npm install -D @playwright/test
npx playwright install chromium  # Solo Chromium para empezar (más rápido)
```

## Paso 2: Verificar Configuración

Los archivos de configuración ya están creados:

- ✅ `apps/pwa/vitest.config.ts` - Configuración de Vitest
- ✅ `apps/pwa/src/test/setup.ts` - Setup global para tests
- ✅ `playwright.config.ts` - Configuración de Playwright (raíz)
- ✅ `apps/pwa/e2e/*.spec.ts` - Ejemplos de tests E2E

## Paso 3: Ejecutar Primeros Tests

```bash
# Tests unitarios (ejemplo - necesitas crear los archivos .test.ts)
npm run test

# Tests E2E (usando los ejemplos creados)
npm run test:e2e
```

## Notas

- Los tests E2E requieren que el servidor de desarrollo esté corriendo (Playwright lo inicia automáticamente)
- Ajusta los selectores en los tests E2E según la UI real de la app
- Agrega más tests según las funcionalidades que necesites verificar

## Siguientes Pasos

1. Crear tests unitarios para componentes críticos
2. Ajustar tests E2E según selectores reales de la UI
3. Agregar más tests según módulos prioritarios
4. Configurar CI/CD para ejecutar tests automáticamente
