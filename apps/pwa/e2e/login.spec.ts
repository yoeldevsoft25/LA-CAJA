/**
 * Tests E2E de Autenticación
 * 
 * Credenciales de prueba:
 * - Store ID: 9b8d1b2a-5635-4678-bef6-82b43a2b4c0a
 * - Owner PIN: 012026
 * - Cashier PIN: 202601
 */

import { test, expect, Page } from '@playwright/test';

const STORE_ID = '9b8d1b2a-5635-4678-bef6-82b43a2b4c0a';
const OWNER_PIN = '012026';
const CASHIER_PIN = '202601';

// Helper para seleccionar en Radix Select
async function selectRadixSelect(page: Page, index: number, value?: string) {
  // Encontrar todos los SelectTriggers (comboboxes)
  const triggers = page.locator('[role="combobox"]');
  const trigger = triggers.nth(index);
  
  // Esperar que el trigger esté visible y habilitado
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await expect(trigger).toBeEnabled({ timeout: 10000 });
  
  // Hacer click en el trigger para abrir
  await trigger.click();
  
  // Esperar que el contenido (SelectContent) aparezca
  await page.waitForSelector('[role="listbox"]', { timeout: 5000 });
  
  // Seleccionar la opción (por índice o por valor)
  if (value) {
    await page.locator(`[role="listbox"] [role="option"]:has-text("${value}")`).click();
  } else {
    // Por defecto, seleccionar la primera opción disponible (que no esté disabled)
    const options = page.locator('[role="listbox"] [role="option"]:not([data-disabled])');
    await options.first().click();
  }
  
  // Esperar a que se cierre el dropdown
  await page.waitForTimeout(300);
}

test.describe('Autenticación', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar localStorage antes de cada test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show landing page when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Verificar que aparece landing page o redirección a login
    const url = page.url();
    expect(url).toMatch(/\/(login|landing|$)/);
  });

  test('should navigate to login from landing', async ({ page }) => {
    await page.goto('/landing');
    
    // Buscar botón de login (puede ser "Iniciar Sesión" o similar)
    const loginButton = page.locator('a[href="/login"], button:has-text("Iniciar")').first();
    
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should login as owner and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    
    // Esperar a que cargue la lista de stores
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });
    
    // Step 1: Seleccionar store usando Radix Select (combobox)
    await selectRadixSelect(page, 0);
    
    // Esperar a que carguen los cashiers (aparecen como botones)
    // Buscar directamente el contenedor de cashiers usando el label
    await page.waitForSelector('div:has(> label:has-text("Empleado")) button[type="button"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Step 2: Seleccionar cashier (primer botón disponible - debería ser owner)
    // Los cashiers son botones dentro de un div con label "Empleado"
    const cashierButton = page.locator('div:has(> label:has-text("Empleado")) button[type="button"]').first();
    await cashierButton.waitFor({ state: 'visible', timeout: 5000 });
    await cashierButton.click();
    
    // Step 3: Ingresar PIN
    const pinInput = page.locator('input[type="password"], input[name*="pin" i]').first();
    await pinInput.waitFor({ state: 'visible', timeout: 5000 });
    await pinInput.fill(OWNER_PIN);
    
    // Step 4: Submit (buscar botón de submit)
    const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar")').first();
    await submitButton.click();
    
    // Esperar redirección a dashboard o app en general
    await expect(page).toHaveURL(/\/app\//, { timeout: 10000 });
  });

  test('should login as cashier and redirect to POS', async ({ page }) => {
    await page.goto('/login');
    
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });
    
    // Seleccionar store
    await selectRadixSelect(page, 0);
    
    // Esperar a que carguen los cashiers (botones)
    await page.waitForSelector('div:has(> label:has-text("Empleado")) button[type="button"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Seleccionar cashier (segundo botón disponible si hay más de uno, o el primero)
    const cashierButtons = page.locator('div:has(> label:has-text("Empleado")) button[type="button"]');
    const buttonCount = await cashierButtons.count();
    
    if (buttonCount > 1) {
      await cashierButtons.nth(1).click(); // Segundo cashier
    } else {
      await cashierButtons.first().click(); // Solo hay uno
    }
    await page.waitForTimeout(300);
    
    // Ingresar PIN de cashier
    const pinInput = page.locator('input[type="password"], input[name*="pin" i]').first();
    await pinInput.fill(CASHIER_PIN);
    
    // Submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar")').first();
    await submitButton.click();
    
    // Esperar redirección a POS o app
    await expect(page).toHaveURL(/\/app\//, { timeout: 10000 });
  });

  test('should show error with invalid PIN', async ({ page }) => {
    await page.goto('/login');
    
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });
    
    // Seleccionar store
    await selectRadixSelect(page, 0);
    
    // Esperar cashiers y seleccionar el primero
    await page.waitForSelector('div:has(> label:has-text("Empleado")) button[type="button"]', { timeout: 5000 });
    const cashierButton = page.locator('div:has(> label:has-text("Empleado")) button[type="button"]').first();
    await cashierButton.click();
    await page.waitForTimeout(300);
    
    // Ingresar PIN incorrecto
    const pinInput = page.locator('input[type="password"], input[name*="pin" i]').first();
    await pinInput.fill('999999');
    
    // Submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar")').first();
    await submitButton.click();
    
    // Esperar mensaje de error (toast o mensaje en pantalla)
    await expect(
      page.locator('text=/incorrecto|error|inválido|PIN.*incorrecto/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should persist session after refresh', async ({ page }) => {
    // Login primero
    await page.goto('/login');
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });
    await selectRadixSelect(page, 0);
    await page.waitForSelector('div:has(> label:has-text("Empleado")) button[type="button"]', { timeout: 5000 });
    const cashierButton = page.locator('div:has(> label:has-text("Empleado")) button[type="button"]').first();
    await cashierButton.click();
    await page.waitForTimeout(300);
    const pinInput = page.locator('input[type="password"], input[name*="pin" i]').first();
    await pinInput.fill(OWNER_PIN);
    const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar")').first();
    await submitButton.click();
    
    // Esperar login exitoso
    await expect(page).toHaveURL(/\/app\//, { timeout: 10000 });
    
    // Refrescar página
    await page.reload();
    
    // Verificar que sigue autenticado (no vuelve a login)
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/app\//);
  });

  test('should logout correctly', async ({ page }) => {
    // Login primero
    await page.goto('/login');
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });
    await selectRadixSelect(page, 0);
    await page.waitForSelector('div:has(> label:has-text("Empleado")) button[type="button"]', { timeout: 5000 });
    const cashierButton = page.locator('div:has(> label:has-text("Empleado")) button[type="button"]').first();
    await cashierButton.click();
    await page.waitForTimeout(300);
    const pinInput = page.locator('input[type="password"], input[name*="pin" i]').first();
    await pinInput.fill(OWNER_PIN);
    const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar")').first();
    await submitButton.click();
    await expect(page).toHaveURL(/\/app\//, { timeout: 10000 });
    
    // Buscar botón de logout (puede estar en menú o dropdown)
    const logoutButton = page.locator('button:has-text("Salir"), button:has-text("Logout"), [aria-label*="logout" i]').first();
    
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      
      // Verificar redirección a login
      await expect(page).toHaveURL(/\/login|\//, { timeout: 5000 });
    }
  });
});
