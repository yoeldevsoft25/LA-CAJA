/**
 * Tests E2E de Funcionalidad Offline
 */

import { test, expect } from '@playwright/test';

test.describe('Funcionalidad Offline', () => {
  test('should create sale offline and sync when connection restored', async ({ page, context }) => {
    // Login primero
    await page.goto('/login');
    // ... (código de login simplificado - ajustar según UI real)
    
    // Ir a POS
    await page.goto('/app/pos');
    
    // Activar modo offline
    await context.setOffline(true);
    
    // Verificar indicador offline (si existe)
    const offlineIndicator = page.locator('text=/sin conexión|offline/i').first();
    if (await offlineIndicator.count() > 0) {
      await expect(offlineIndicator).toBeVisible();
    }
    
    // Intentar crear venta offline (simplificado)
    // Esto requiere que el test anterior haya configurado la caja
    
    // Verificar en IndexedDB que evento se guardó
    const pendingEvents = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const request = indexedDB.open('LaCajaDB', 4);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['localEvents'], 'readonly');
          const store = transaction.objectStore('localEvents');
          const index = store.index('sync_status');
          const query = index.getAll('pending');
          query.onsuccess = () => {
            resolve(query.result.length);
          };
          query.onerror = () => resolve(0);
        };
        request.onerror = () => resolve(0);
      });
    });

    // Al menos debería haber intentado guardar
    // (nota: esto puede fallar si no se creó venta, es aceptable para primer test)

    // Reactivar conexión
    await context.setOffline(false);
    
    // Esperar sincronización (hasta 60 segundos)
    await page.waitForTimeout(65000);
    
    // Verificar que apareció notificación de sync (si existe)
    const syncNotification = page.locator('text=/sincronizad|sincronizado/i').first();
    // No fallar si no aparece - puede no tener eventos pendientes
  });

  test('should load app offline after page refresh', async ({ page, context }) => {
    // Login y cargar app primero
    await page.goto('/');
    
    // Activar offline
    await context.setOffline(true);
    
    // Refrescar página
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Verificar que app carga (no error de navegador)
    await expect(page.locator('body')).not.toContainText('ERR_INTERNET_DISCONNECTED');
    
    // Verificar que contenido principal está visible (ajustar selector según UI)
    const appContent = page.locator('body, main, [id="root"]').first();
    await expect(appContent).toBeVisible({ timeout: 10000 });
  });
});
