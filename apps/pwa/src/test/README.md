# Testing Setup - PWA

Este directorio contiene la configuración y utilidades para testing.

## Archivos

- `setup.ts` - Configuración global para Vitest (mocks, cleanup, etc.)

## Ejecutar Tests

```bash
# Tests unitarios/integración
npm run test              # Ejecutar todos
npm run test:ui           # UI interactiva
npm run test:watch        # Modo watch
npm run test:coverage     # Con cobertura

# Tests E2E (Playwright)
npm run test:e2e          # Ejecutar todos
npm run test:e2e:ui       # UI interactiva
npm run test:e2e:debug    # Modo debug
npm run test:e2e:headed   # Con navegador visible
```

## Estructura de Tests

```
apps/pwa/
├── src/
│   ├── components/
│   │   └── ui/
│   │       └── button.test.tsx      # Test unitario de componente
│   ├── services/
│   │   └── sync.service.test.ts     # Test de servicio
│   └── test/
│       └── setup.ts                 # Configuración global
└── e2e/
    ├── login.spec.ts                # Test E2E de login
    ├── pos-flow.spec.ts             # Test E2E de flujo POS
    └── offline.spec.ts              # Test E2E offline
```
