import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para E2E testing
 * 
 * Para ejecutar tests:
 * - npx playwright test
 * - npx playwright test --ui (interfaz gráfica)
 * - npx playwright test --debug (modo debug)
 */

export default defineConfig({
  testDir: './apps/pwa/e2e',
  
  /* Ejecutar tests en paralelo */
  fullyParallel: true,
  
  /* Fallar en CI si hay .only() en tests */
  forbidOnly: !!process.env.CI,
  
  /* Reintentos en CI */
  retries: process.env.CI ? 2 : 0,
  
  /* Workers en CI */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter */
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github']] : []),
  ],
  
  /* Compartir configuración para todos los proyectos */
  use: {
    /* URL base para tests */
    baseURL: 'http://localhost:5173',
    
    /* Capturar trace en fallos */
    trace: 'on-first-retry',
    
    /* Capturar screenshot solo en fallos */
    screenshot: 'only-on-failure',
    
    /* Capturar video solo en fallos */
    video: 'retain-on-failure',
    
    /* Timeouts */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  /* Proyectos de testing en diferentes navegadores */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Descomentar para probar en otros navegadores
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    
    /* Testing móvil */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Servidor de desarrollo antes de tests */
  webServer: {
    command: 'npm run dev:pwa',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
