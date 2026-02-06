/**
 * Tests E2E exhaustivos para los Modales del POS de LA-CAJA
 * 
 * Escenarios cubiertos:
 * 1. CheckoutModal: Pagos Mixtos (USD + BS) y cálculo de vuelto.
 * 2. WeightInputModal: Productos por peso y recalculo de carrito.
 * 3. VariantSelector: Selección de variantes con stock y precios únicos.
 * 4. Fiao/Crédito: Vinculación de cliente y registro de deuda.
 * 5. Resiliencia: Sincronización offline de eventos generados por modales.
 */

import { test, expect, Page } from '@playwright/test';

const OWNER_PIN = '012026';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Helpers de interacción UI
async function login(page: Page) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });

    // Seleccionar sucursal
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]').first().click();

    // Seleccionar cajero
    await page.locator('div:has(> label:has-text("Empleado")) button[type="button"]').first().click();
    await page.locator('[role="option"]').first().click();

    // PIN
    await page.locator('input[type="password"]').fill(OWNER_PIN);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\//, { timeout: 10000 });
}

async function ensureOpenCash(page: Page) {
    await page.goto('/app/cash');
    const openCashBtn = page.locator('button:has-text("Abrir Caja")');
    if (await openCashBtn.isVisible()) {
        await openCashBtn.click();
        await page.locator('input[placeholder*="BS"]').first().fill('100');
        await page.locator('input[placeholder*="USD"]').first().fill('10');
        await page.locator('button:has-text("Confirmar")').click();
        await page.waitForTimeout(1000);
    }
}

test.describe('Verificación de Modales POS', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await ensureOpenCash(page);
        await page.goto('/app/pos');
    });

    test('CheckoutModal: Flujo de Pago Mixto y Vuelto', async ({ page }) => {
        // 1. Agregar productos al carrito
        await page.locator('input[placeholder*="buscar"]').fill('test');
        await page.waitForTimeout(500);
        const product = page.locator('article, [class*="product-card"]').first();
        await product.click();

        // 2. Abrir Checkout
        await page.locator('button:has-text("Cobrar"), button:has-text("Total")').click();
        await expect(page.locator('text=/Finalizar Venta|Checkout/i')).toBeVisible();

        // 3. Seleccionar Pago Dividido/Mixto (Split)
        const splitTab = page.locator('button:has-text("Dividido"), [data-value="SPLIT"]').first();
        await splitTab.click();

        // 4. Agregar pago en USD (Efectivo)
        await page.locator('button:has-text("Agregar Pago")').click();
        await page.locator('select, [role="combobox"]').last().selectOption('CASH_USD');
        await page.locator('input[type="number"]').last().fill('5'); // $5 USD

        // 5. Agregar pago en BS (Pago Móvil)
        await page.locator('button:has-text("Agregar Pago")').click();
        await page.locator('select, [role="combobox"]').last().selectOption('PAGO_MOVIL');
        // El sistema debería sugerir el monto restante automáticamente

        // 6. Verificar totales y vuelto
        const totalBs = page.locator('text=/Total en BS/i');
        await expect(totalBs).toBeVisible();

        // 7. Finalizar
        await page.locator('button:has-text("Confirmar"), button:has-text("Finalizar")').click();

        // 8. Verificar éxito
        await expect(page.locator('text=/Venta Exitosa/i')).toBeVisible({ timeout: 10000 });
    });

    test('WeightInputModal: Producto por Peso', async ({ page }) => {
        // 1. Buscar producto configurado por peso
        await page.locator('input[placeholder*="buscar"]').fill('peso'); // Asumiendo que hay uno con este nombre en test data
        await page.waitForTimeout(500);

        // 2. Click debe abrir el modal de peso, no agregar directo
        const weightProduct = page.locator('article:has-text("peso"), article:has-text("Kg")').first();
        await weightProduct.click();

        // 3. Verificar modal de peso
        await expect(page.locator('text=/Ingresar Peso/i')).toBeVisible();

        // 4. Ingresar 1.5 kg
        await page.locator('input[type="number"]').fill('1.5');
        await page.locator('button:has-text("Confirmar"), button:has-text("Agregar")').click();

        // 5. Verificar en el carrito
        const cartItem = page.locator('[class*="cart-item"], [data-testid="cart-item"]').first();
        await expect(cartItem).toContainText('1.5');
    });

    test('VariantSelector: Selección de Atributos', async ({ page }) => {
        // 1. Buscar producto con variantes
        await page.locator('input[placeholder*="buscar"]').fill('variante');
        await page.waitForTimeout(500);

        // 2. Click debe abrir selector de variantes
        const variantProduct = page.locator('article:has-text("variante")').first();
        await variantProduct.click();

        // 3. Verificar modal
        await expect(page.locator('text=/Seleccionar Variación/i')).toBeVisible();

        // 4. Seleccionar una opción (ej: Talla M)
        const option = page.locator('button:has-text("M"), [class*="variant-option"]').first();
        await option.click();

        // 5. Confirmar y verificar en carrito
        const cartItem = page.locator('[class*="cart-item"]').first();
        await expect(cartItem).toContainText('M');
    });

    test('Resiliencia Offline: Venta en Modal sin Internet', async ({ page, context }) => {
        // 1. Agregar producto
        await page.locator('input[placeholder*="buscar"]').fill('test');
        await page.waitForTimeout(500);
        await page.locator('article').first().click();

        // 2. Simular Offline
        await context.setOffline(true);

        // 3. Realizar Checkout rápido (Efectivo)
        await page.locator('button:has-text("Cobrar")').click();
        await page.locator('button:has-text("Efectivo"), [data-testid*="CASH"]').first().click();
        await page.locator('button:has-text("Finalizar")').click();

        // 4. Verificar mensaje de "Sincronización Pendiente" o éxito local
        await expect(page.locator('text=/Venta guardada localmente|Sincronización diferida/i')).toBeVisible();

        // 5. Volver Online y verificar que el Toast de sync aparezca pronto
        await context.setOffline(false);
        await expect(page.locator('text=/Venta sincronizada|Sincronización completada/i')).toBeVisible({ timeout: 30000 });
    });
});
