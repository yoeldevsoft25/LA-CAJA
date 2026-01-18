/**
 * Tests E2E de Flujo POS Completo
 * 
 * Requiere:
 * - Login exitoso
 * - Caja abierta
 * - Productos disponibles
 */

import { test, expect, Page } from '@playwright/test';

const STORE_ID = '9b8d1b2a-5635-4678-bef6-82b43a2b4c0a';
const OWNER_PIN = '012026';

// Helper para seleccionar en Radix Select
async function selectRadixSelect(page: Page, index: number, value?: string) {
  const triggers = page.locator('[role="combobox"]');
  const trigger = triggers.nth(index);
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await expect(trigger).toBeEnabled({ timeout: 10000 });
  await trigger.click();
  await page.waitForSelector('[role="listbox"]', { timeout: 5000 });
  if (value) {
    await page.locator(`[role="listbox"] [role="option"]:has-text("${value}")`).click();
  } else {
    const options = page.locator('[role="listbox"] [role="option"]:not([data-disabled])');
    await options.first().click();
  }
  await page.waitForTimeout(300);
}

test.describe('Flujo POS', () => {
  // Helper para login
  async function login(page: Page) {
    await page.goto('/login');
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });
    
    // Seleccionar store
    await selectRadixSelect(page, 0);
    
    // Esperar cashiers y seleccionar el primero
    await page.waitForSelector('div:has(> label:has-text("Empleado")) button[type="button"]', { timeout: 5000 });
    const cashierButton = page.locator('div:has(> label:has-text("Empleado")) button[type="button"]').first();
    await cashierButton.click();
    await page.waitForTimeout(300);
    
    // Ingresar PIN y submit
    const pinInput = page.locator('input[type="password"], input[name*="pin" i]').first();
    await pinInput.fill(OWNER_PIN);
    const submitButton = page.locator('button[type="submit"], button:has-text("Iniciar")').first();
    await submitButton.click();
    await expect(page).toHaveURL(/\/app\//, { timeout: 10000 });
  }

  test('should open cash session before creating sale', async ({ page }) => {
    await login(page);

    // Ir a página de caja
    await page.goto('/app/cash');
    
    // Verificar si hay caja abierta o abrir una
    const openCashButton = page.locator('button:has-text("Abrir Caja"), button:has-text("Abrir")').first();
    
    if (await openCashButton.count() > 0) {
      await openCashButton.click();
      
      // Llenar formulario de apertura
      await page.locator('input[name*="opening_amount_bs" i], input[placeholder*="BS" i]').first().fill('100');
      await page.locator('input[name*="opening_amount_usd" i], input[placeholder*="USD" i]').first().fill('10');
      
      // Confirmar apertura
      await page.locator('button:has-text("Confirmar"), button:has-text("Abrir")').last().click();
      
      // Esperar confirmación
      await expect(page.locator('text=/abierta|exitoso/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should search and add products to cart', async ({ page }) => {
    await login(page);
    
    // Ir a POS
    await page.goto('/app/pos');
    
    // Buscar producto
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"], input[name*="search" i]').first();
    await searchInput.fill('test');
    
    // Esperar resultados
    await page.waitForTimeout(500);
    
    // Verificar que hay productos en la lista
    const productList = page.locator('[data-testid="product-list"], [class*="product"], article').first();
    
    if (await productList.count() > 0) {
      // Click en primer producto
      await productList.click();
      
      // Verificar que aparece en carrito
      const cart = page.locator('[data-testid="cart"], [class*="cart"], aside').first();
      await expect(cart).toBeVisible();
    }
  });

  test('should create sale with CASH_BS payment', async ({ page }) => {
    await login(page);
    await page.goto('/app/pos');
    
    // Asegurar caja abierta (ejecutar test anterior o verificar)
    
    // Agregar producto (simplificado - puede necesitar ajustes según UI real)
    const searchInput = page.locator('input[placeholder*="buscar" i], input[type="search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
    
    // Buscar botón de checkout/cobrar
    const checkoutButton = page.locator('button:has-text("Cobrar"), button:has-text("Checkout"), [data-testid="checkout"]').first();
    
    if (await checkoutButton.count() > 0) {
      await checkoutButton.click();
      
      // En modal de checkout, seleccionar método de pago
      const cashBSButton = page.locator('button:has-text("Efectivo BS"), [data-testid="payment-CASH_BS"]').first();
      
      if (await cashBSButton.count() > 0) {
        await cashBSButton.click();
        
        // Confirmar venta
        const confirmButton = page.locator('button:has-text("Confirmar"), button:has-text("Finalizar")').last();
        await confirmButton.click();
        
        // Verificar toast de éxito
        await expect(page.locator('text=/venta|exitoso|procesada/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
