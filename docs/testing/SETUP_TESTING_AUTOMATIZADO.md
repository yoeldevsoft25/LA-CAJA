# 🧪 Setup de Testing Automatizado - LA CAJA

> Guía completa para configurar testing automatizado en la aplicación

**Fecha:** 2024-12-28  
**Versión:** 1.0

---

## 🎯 Objetivo

Configurar una suite completa de testing automatizado para:
- ✅ Tests unitarios (componentes, hooks, servicios)
- ✅ Tests de integración (flujos completos)
- ✅ Tests E2E (end-to-end con navegador real)

---

## 📦 Stack de Testing

### Frontend (PWA)
- **Vitest** - Test runner (más rápido que Jest, compatible con Vite)
- **@testing-library/react** - Testing de componentes React
- **@testing-library/user-event** - Simulación de interacciones de usuario
- **Playwright** - E2E testing con navegador real

### Backend (API)
- **Jest** - Ya configurado ✅
- **Supertest** - Testing de endpoints HTTP
- **@nestjs/testing** - Testing utilities para NestJS

---

## 🚀 Paso 1: Instalar Dependencias (Frontend)

```bash
cd apps/pwa
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom happy-dom
```

Para E2E (Playwright):
```bash
npm install -D @playwright/test
npx playwright install
```

---

## ⚙️ Paso 2: Configurar Vitest

Crear `apps/pwa/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@la-caja/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@la-caja/sync': path.resolve(__dirname, '../../packages/sync/src/index.ts'),
    },
  },
});
```

---

## 📝 Paso 3: Setup de Testing Utilities

Crear `apps/pwa/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Limpiar después de cada test
afterEach(() => {
  cleanup();
});

// Mock de IndexedDB
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
} as any;

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock de navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});
```

---

## 📝 Paso 4: Configurar Playwright

Crear `playwright.config.ts` en la raíz:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/pwa/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev:pwa',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 🧪 Paso 5: Ejemplos de Tests

### Test Unitario - Componente Simple

Crear `apps/pwa/src/components/ui/button.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Test de Integración - Servicio

Crear `apps/pwa/src/services/sync.service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from './sync.service';

// Mock de IndexedDB
vi.mock('@/db/database', () => ({
  db: {
    localEvents: {
      add: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
    },
  },
}));

describe('SyncService', () => {
  let syncService: SyncService;

  beforeEach(() => {
    syncService = new SyncService();
  });

  it('initializes correctly', async () => {
    await syncService.initialize('store-123', 'device-456');
    const status = syncService.getStatus();
    expect(status.isInitialized).toBe(true);
  });

  it('saves events to IndexedDB', async () => {
    await syncService.initialize('store-123', 'device-456');
    
    const event = {
      event_id: 'event-123',
      store_id: 'store-123',
      device_id: 'device-456',
      seq: 1,
      type: 'SaleCreated',
      version: 1,
      created_at: Date.now(),
      actor: { user_id: 'user-123', role: 'cashier' },
      payload: {},
    };

    await syncService.enqueueEvent(event);
    
    // Verificar que se guardó localmente
    expect(await db.localEvents.where('event_id').equals('event-123').first()).toBeDefined();
  });
});
```

### Test E2E - Login y POS

Crear `apps/pwa/e2e/login-and-pos.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const STORE_ID = '9b8d1b2a-5635-4678-bef6-82b43a2b4c0a';
const OWNER_PIN = '012026';
const CASHIER_PIN = '202601';

test.describe('Login and POS Flow', () => {
  test('should login as owner and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    
    // Step 1: Seleccionar store
    await page.selectOption('[data-testid="store-select"]', STORE_ID);
    
    // Step 2: Seleccionar cashier (esperar a que cargue)
    await page.waitForSelector('[data-testid="cashier-select"]');
    await page.selectOption('[data-testid="cashier-select"]', { index: 0 }); // Primer cashier (owner)
    
    // Step 3: Ingresar PIN
    await page.fill('[data-testid="pin-input"]', OWNER_PIN);
    
    // Step 4: Submit
    await page.click('button[type="submit"]');
    
    // Verificar redirección
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('should login as cashier and redirect to POS', async ({ page }) => {
    await page.goto('/login');
    
    await page.selectOption('[data-testid="store-select"]', STORE_ID);
    await page.waitForSelector('[data-testid="cashier-select"]');
    // Seleccionar cashier (no owner)
    await page.selectOption('[data-testid="cashier-select"]', { index: 1 });
    await page.fill('[data-testid="pin-input"]', CASHIER_PIN);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/app\/pos/);
  });

  test('should create sale in POS', async ({ page }) => {
    // Primero hacer login
    await page.goto('/login');
    await page.selectOption('[data-testid="store-select"]', STORE_ID);
    await page.waitForSelector('[data-testid="cashier-select"]');
    await page.selectOption('[data-testid="cashier-select"]', { index: 0 });
    await page.fill('[data-testid="pin-input"]', OWNER_PIN);
    await page.click('button[type="submit"]');
    
    // Ir a POS
    await page.goto('/app/pos');
    
    // Buscar producto
    await page.fill('[data-testid="product-search"]', 'test');
    await page.waitForSelector('[data-testid="product-list"]');
    
    // Agregar producto al carrito (click en primer producto)
    await page.click('[data-testid="product-item"]:first-child');
    
    // Verificar que aparece en carrito
    await expect(page.locator('[data-testid="cart-items"]')).toContainText('test');
    
    // Abrir checkout
    await page.click('[data-testid="checkout-button"]');
    
    // Seleccionar método de pago
    await page.click('[data-testid="payment-method-CASH_BS"]');
    
    // Confirmar venta
    await page.click('[data-testid="confirm-sale-button"]');
    
    // Verificar toast de éxito
    await expect(page.locator('text=/venta.*exitosamente/i')).toBeVisible();
  });
});
```

### Test E2E - Funcionalidad Offline

Crear `apps/pwa/e2e/offline-functionality.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Offline Functionality', () => {
  test('should create sale offline and sync when online', async ({ page, context }) => {
    // Login primero
    await page.goto('/login');
    // ... (código de login)

    // Ir a POS
    await page.goto('/app/pos');

    // Activar modo offline
    await context.setOffline(true);
    
    // Agregar producto y crear venta
    await page.fill('[data-testid="product-search"]', 'test');
    await page.click('[data-testid="product-item"]:first-child');
    await page.click('[data-testid="checkout-button"]');
    await page.click('[data-testid="payment-method-CASH_BS"]');
    await page.click('[data-testid="confirm-sale-button"]');

    // Verificar toast "guardada localmente"
    await expect(page.locator('text=/guardada localmente/i')).toBeVisible();

    // Verificar en IndexedDB (desde console)
    const eventsCount = await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('LaCajaDB', 4);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['localEvents'], 'readonly');
          const store = transaction.objectStore('localEvents');
          const index = store.index('sync_status');
          const query = index.getAll('pending');
          query.onsuccess = () => resolve(query.result.length);
        };
      });
    });

    expect(eventsCount).toBeGreaterThan(0);

    // Reactivar conexión
    await context.setOffline(false);
    
    // Esperar sincronización (30 segundos)
    await page.waitForTimeout(35000);

    // Verificar toast de sincronización
    await expect(page.locator('text=/sincronizad/i')).toBeVisible({ timeout: 5000 });
  });

  test('should load app offline after F5', async ({ page, context }) => {
    // Login y cargar app primero
    // ...

    // Activar offline
    await context.setOffline(true);

    // Refrescar página
    await page.reload();

    // Verificar que app carga (no error de Chrome)
    await expect(page.locator('body')).not.toContainText('ERR_INTERNET_DISCONNECTED');
    await expect(page.locator('[data-testid="app-content"]')).toBeVisible();
  });
});
```

---

## 📋 Paso 6: Scripts en package.json

Actualizar `apps/pwa/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## 🎯 Paso 7: Tests Priorizados por Módulo

### Módulos Críticos (Implementar Primero)

1. **Autenticación**
   - `apps/pwa/src/pages/LoginPage.test.tsx`
   - `apps/pwa/src/services/auth.service.test.ts`

2. **POS**
   - `apps/pwa/src/pages/POSPage.test.tsx`
   - `apps/pwa/src/services/sales.service.test.ts`

3. **Sync/Offline**
   - `apps/pwa/src/services/sync.service.test.ts`
   - `apps/pwa/e2e/offline-functionality.spec.ts`

4. **Productos**
   - `apps/pwa/src/pages/ProductsPage.test.tsx`
   - `apps/pwa/src/services/products.service.test.ts`

---

## 🚀 Cómo Ejecutar Tests

### Tests Unitarios/Integración
```bash
cd apps/pwa
npm run test              # Ejecutar todos los tests
npm run test:ui           # UI interactiva de Vitest
npm run test:coverage     # Con reporte de cobertura
```

### Tests E2E
```bash
npx playwright test                # Ejecutar todos los E2E
npx playwright test --ui          # UI interactiva
npx playwright test --debug       # Modo debug paso a paso
npx playwright test login         # Solo tests de login
```

### Tests en CI/CD (GitHub Actions)
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test --workspace=apps/pwa
      - run: npx playwright test
```

---

## 📊 Meta de Cobertura

| Módulo | Meta de Cobertura | Prioridad |
|--------|------------------|-----------|
| **Sync Service** | 80%+ | 🔴 Crítica |
| **Sales Service** | 80%+ | 🔴 Crítica |
| **Auth Service** | 75%+ | 🔴 Crítica |
| **POSPage** | 70%+ | 🟠 Alta |
| **Products Service** | 70%+ | 🟠 Alta |
| **Otros módulos** | 60%+ | 🟡 Media |

---

## 📝 Checklist de Implementación

- [ ] ⬜ Instalar dependencias de testing
- [ ] ⬜ Configurar Vitest
- [ ] ⬜ Configurar Playwright
- [ ] ⬜ Crear setup de testing utilities
- [ ] ⬜ Implementar tests de autenticación
- [ ] ⬜ Implementar tests de POS
- [ ] ⬜ Implementar tests de sync/offline
- [ ] ⬜ Implementar E2E tests críticos
- [ ] ⬜ Configurar CI/CD para tests
- [ ] ⬜ Documentar proceso de testing

---

**Última actualización:** 2024-12-28  
**Próximo paso:** Instalar dependencias y crear primeros tests
