# Test Manual E2E: Offline→Online Sin F5

## Objetivo
Validar que el sistema sincroniza eventos offline pendientes automáticamente al reconectar, sin necesidad de recargar la página (F5).

## Pre-requisitos
- Build exitoso de la aplicación
- Acceso a DevTools del navegador
- Sesión de usuario autenticada

## Escenario de Prueba

### 1. Preparación (Online)
1. Abrir la aplicación en el navegador
2. Iniciar sesión con credenciales válidas
3. Abrir DevTools (F12)
   - Ir a la pestaña **Console**
   - Ir a la pestaña **Application** → **IndexedDB** → `db.kv`
4. Verificar que el contexto SW está completo:
   ```
   - api_url: [debe tener valor]
   - auth_token: [debe tener valor]
   - store_id: [debe tener valor]
   - device_id: [debe tener valor]
   ```

### 2. Crear Ventas Offline
1. En DevTools, ir a **Network** tab
2. Activar modo **Offline** (checkbox en la parte superior)
3. Verificar en Console que aparece: `📵 Conexión perdida`
4. Crear 3 ventas en el POS:
   - Venta 1: Producto A, cantidad 1
   - Venta 2: Producto B, cantidad 2
   - Venta 3: Producto C, cantidad 1
5. Verificar en Console logs como:
   ```
   [SyncService] Evento guardado/encolado
   ```
6. En DevTools → **Application** → **IndexedDB** → `localEvents`
   - Verificar que hay 3+ eventos con `sync_status: "pending"`

### 3. Volver Online (SIN F5)
1. En DevTools Network tab, **desactivar** modo Offline
2. **NO RECARGAR LA PÁGINA**
3. Observar en Console la secuencia de logs:

#### Logs Esperados:
```
[SyncService] 🌐 Evento online detectado, ejecutando hard recovery
[SyncService] 🚀 Iniciando Hard Recovery Sync
[SyncService] 📊 Pendientes en IndexedDB: 3, en cola: 3
[SyncService] ⬆️ Ejecutando flush de eventos pendientes...
[SyncService] Enviando /sync/push
[SyncService] ⬇️ Ejecutando pull de eventos del servidor...
[SyncService] ✅ Hard Recovery completado en XXXms (3 eventos sincronizados)
[App] 🎉 Evento global sync:completed recibido
```

#### Métricas de Telemetría Esperadas:
```
reconnect_triggered: { queue_depth_before: 3 }
pending_loaded: { count: 3, queue_depth: 3 }
push_success: { synced_count: 3, queue_depth_after: 0, duration_ms: XXX }
```

### 4. Validaciones

#### A) Cola Vacía en <10 segundos
- En Console, verificar que `queue_depth_after: 0`
- En IndexedDB → `localEvents`, verificar que los eventos tienen `sync_status: "synced"`

#### B) UI Actualizada Sin F5
- Ir a la página de **Ventas**
- Verificar que las 3 ventas creadas offline **aparecen en la lista**
- NO debe ser necesario recargar la página

#### C) Notificación al Usuario
- Debe aparecer un toast de éxito:
  ```
  ✅ 3 eventos sincronizados
  Todo sincronizado
  ```

#### D) Sin Dobles Inicializaciones
- En Console, buscar logs de "Inicializando servicio de sincronización"
- Debe aparecer **solo UNA vez** por sesión
- NO debe haber múltiples inicializaciones al cambiar de ruta

### 5. Validación de Fallback (Si SW Falla)

#### Simular Error 400 del SW:
1. En DevTools → **Application** → **Service Workers**
2. Detener el Service Worker (Stop)
3. Repetir pasos 2-3 (crear ventas offline, volver online)
4. Verificar que el foreground recovery funciona:
   ```
   [SyncService] ⚠️ Error de validación detectado, activando fallback foreground
   [SyncService] 📊 Telemetría: fallback_foreground
   ```

### 6. Validación de Listeners Múltiples

#### Test de Visibilitychange:
1. Crear 1 venta offline
2. Cambiar a otra pestaña del navegador
3. Volver online (en otra pestaña, cambiar configuración de red)
4. Volver a la pestaña de la app
5. Verificar log:
   ```
   [SyncService] 👁️ App visible + online, verificando pendientes
   [SyncService] Detectados 1 eventos pendientes, sincronizando...
   ```

#### Test de Focus:
1. Crear 1 venta offline
2. Minimizar la ventana del navegador
3. Volver online
4. Restaurar la ventana
5. Verificar log:
   ```
   [SyncService] 🎯 Ventana recuperó foco + online
   [SyncService] Focus + 1 pendientes, sincronizando...
   ```

## Criterios de Aceptación

### ✅ PASS:
- [ ] Cola de eventos llega a 0 en menos de 10 segundos
- [ ] Ventas aparecen en la UI sin F5
- [ ] Toast de confirmación se muestra al usuario
- [ ] No hay dobles inicializaciones de SyncService
- [ ] Logs de telemetría completos (reconnect_triggered, pending_loaded, push_success)
- [ ] Contexto SW completo en IndexedDB (api_url, auth_token, store_id, device_id)
- [ ] Fallback foreground funciona si SW falla

### ❌ FAIL:
- [ ] Necesita F5 para ver las ventas sincronizadas
- [ ] Cola no se vacía automáticamente
- [ ] Errores CORS o 400 bloqueantes
- [ ] Eventos pendientes no drenan al reconectar
- [ ] Múltiples inicializaciones de SyncService
- [ ] Falta contexto en IndexedDB para SW

## Logs de Evidencia

### Antes de la Sincronización:
```
[Captura de pantalla de IndexedDB mostrando eventos pending]
[Captura de Console mostrando queue_depth_before]
```

### Durante la Sincronización:
```
[Captura de Console mostrando logs de hard recovery]
[Captura de Network tab mostrando POST /sync/push exitoso]
```

### Después de la Sincronización:
```
[Captura de IndexedDB mostrando eventos synced]
[Captura de UI mostrando ventas sincronizadas]
[Captura de toast de confirmación]
```

## Troubleshooting

### Si la sincronización no se dispara:
1. Verificar que `navigator.onLine` es `true` en Console
2. Verificar que no hay errores en Console
3. Verificar que el contexto SW está completo en IndexedDB
4. Verificar que los eventos tienen `sync_status: "pending"`

### Si aparecen errores 400:
1. Revisar Console para ver el payload que causó el error
2. Verificar que `store_id` y `device_id` son UUIDs válidos
3. Verificar que `actor.user_id` está presente en los eventos
4. Revisar logs del SW en Console para más detalles

### Si la UI no se actualiza:
1. Verificar que el evento `sync:completed` se emitió (buscar en Console)
2. Verificar que React Query invalidó los caches (buscar logs de invalidación)
3. Verificar que no hay errores en el componente de ventas

## Tiempo Estimado
- Preparación: 2 minutos
- Ejecución: 5 minutos
- Validación: 3 minutos
- **Total: ~10 minutos**
