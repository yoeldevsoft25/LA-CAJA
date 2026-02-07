
import { test, expect } from '@playwright/test';

// Este test intenta reproducir el fallo del flujo "FIAO" en producción.
// Asumimos que el usuario ya está autenticado o que el sistema maneja la sesión.
// Para correr: BASE_URL=https://veloxpos.app npx playwright test e2e/reproduce-fiao-issue.spec.ts

test.describe('Reproduction: FIAO Flow Failure', () => {
    test.beforeEach(async ({ page }) => {
        const baseURL = process.env.BASE_URL || 'http://localhost:5173';
        await page.goto(baseURL);

        // Esperar a que la app cargue y se hidrate
        await page.waitForSelector('text=Cargando', { state: 'detached', timeout: 30000 });
    });

    test('should attempt a FIAO sale and log the result', async ({ page }) => {
        // 1. Agregar un producto al carrito
        // (Ajustar selectores según la UI real)
        await page.click('[data-testid="product-card"]'); // Clic en el primer producto

        // 2. Abrir el modal de checkout
        await page.click('button:has-text("Cobrar")');
        await expect(page.locator('text=Finalizar venta')).toBeVisible();

        // 3. Seleccionar método de pago FIAO
        await page.click('button:has-text("FIAO")');

        // 4. Seleccionar un cliente (Esto es crítico)
        // Buscamos a "Consumidor Final" o similar que suele existir
        await page.fill('input[placeholder*="Buscar cliente"]', 'Consumidor');
        await page.click('button:has-text("Consumidor Final")');

        // 5. Intentar confirmar el pago
        const confirmButton = page.locator('button:has-text("Confirmar pago")');
        await confirmButton.click();

        // 6. Observar el resultado
        // Si falla en producción, deberíamos ver un mensaje de error o un timeout.
        try {
            await expect(page.locator('text=Venta realizada con éxito')).toBeVisible({ timeout: 15000 });
            console.log('✅ FIAO sale successful in this environment');
        } catch (e) {
            console.error('❌ FIAO sale failed or timed out');

            // Capturar el mensaje de error de la UI si existe
            const errorText = await page.locator('[role="alert"]').innerText().catch(() => 'No visible error alert');
            console.error('Visible error in UI:', errorText);

            // Capturar screenshot para revisión manual
            await page.screenshot({ path: 'fiao-failure-reproduction.png' });
        }
    });
});
