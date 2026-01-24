# ✅ Fix: Mensajes de WhatsApp No Se Están Enviando

## 🐛 Problema Identificado

Los mensajes de WhatsApp no se estaban enviando porque:

1. **Bot no se inicializa automáticamente**: El bot solo se inicializa cuando se llama manualmente al endpoint de inicialización
2. **Logging silencioso**: Cuando el bot no está conectado, solo se loguea en nivel `debug`, que no es visible por defecto
3. **Sin intento de restauración automática**: Si hay una sesión guardada pero el bot no está inicializado, no se intenta restaurar automáticamente

---

## ✅ Solución Implementada

### 1. **Inicialización Automática al Iniciar el Módulo**

**Archivo**: `apps/api/src/whatsapp/whatsapp-queue.processor.ts`

Se agregó `OnModuleInit` para inicializar automáticamente los bots al iniciar la aplicación si:
- Hay mensajes pendientes en la cola
- Hay una sesión guardada del bot

```typescript
async onModuleInit() {
  // Obtener tiendas con mensajes pendientes
  const storesWithPendingMessages = await this.messageQueueRepository
    .createQueryBuilder('msg')
    .select('DISTINCT msg.store_id', 'store_id')
    .where('msg.status IN (:...statuses)', { statuses: ['pending', 'retrying'] })
    .getRawMany();

  // Inicializar bots automáticamente si hay sesión guardada
  for (const { store_id } of storesWithPendingMessages) {
    const hasSession = this.whatsappBotService.hasSavedSession(store_id);
    if (!hasBot && hasSession) {
      await this.whatsappBotService.initializeBot(store_id);
    }
  }
}
```

---

### 2. **Restauración Automática Durante el Procesamiento**

**Archivo**: `apps/api/src/whatsapp/whatsapp-queue.processor.ts`

Cuando el procesador encuentra mensajes pendientes pero el bot no está conectado:
- **Intenta restaurar automáticamente** si hay una sesión guardada
- **Loguea en nivel WARN** (visible) en lugar de DEBUG
- **Proporciona mensajes claros** sobre qué hacer si no hay sesión

```typescript
private async processStoreMessages(storeId: string, messages: WhatsAppMessageQueue[]): Promise<void> {
  if (!this.whatsappBotService.isConnected(storeId)) {
    const hasSession = this.whatsappBotService.hasSavedSession(storeId);
    const hasBot = this.whatsappBotService.hasBot(storeId);
    
    if (!hasBot && hasSession) {
      // Intentar restaurar automáticamente
      await this.whatsappBotService.initializeBot(storeId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (this.whatsappBotService.isConnected(storeId)) {
        this.logger.log(`Bot restaurado exitosamente para tienda ${storeId}`);
      }
    } else {
      // Log visible en nivel WARN
      this.logger.warn(
        `Bot no conectado para tienda ${storeId} (hasBot: ${hasBot}, hasSession: ${hasSession}), ` +
        `omitiendo ${messages.length} mensajes. Inicializa el bot desde la configuración de WhatsApp.`
      );
    }
  }
}
```

---

### 3. **Mejor Logging de Errores**

**Archivo**: `apps/api/src/whatsapp/whatsapp-queue.processor.ts`

Se mejoró el logging para que los errores sean más visibles:

```typescript
if (result.success) {
  this.logger.log(`Mensaje ${message.id} enviado exitosamente a ${message.customer_phone}`);
} else {
  // Ahora loguea en WARN (visible) en lugar de solo guardar el error
  this.logger.warn(`Error enviando mensaje ${message.id} a ${message.customer_phone}: ${result.error}`);
  await this.handleSendError(message);
}
```

---

## 🔍 Diagnóstico

### Verificar Estado del Bot

**Endpoint**: `GET /whatsapp/status`

Respuesta:
```json
{
  "isConnected": false,
  "whatsappNumber": null,
  "connectionState": null
}
```

### Verificar Mensajes Pendientes

**Query SQL**:
```sql
SELECT 
  store_id,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_message
FROM whatsapp_message_queue
WHERE status IN ('pending', 'retrying')
GROUP BY store_id, status;
```

### Verificar Sesiones Guardadas

**Directorio**: `whatsapp-sessions/{store_id}/`

Si existe `creds.json` o archivos `app-state-sync-key-*`, hay una sesión guardada.

---

## 🚀 Cómo Usar

### 1. **Inicializar Bot Manualmente** (Recomendado la primera vez)

1. Ir a la página de configuración de WhatsApp en el frontend
2. Hacer clic en "Inicializar Bot"
3. Escanear el QR code con WhatsApp
4. El bot se conectará automáticamente

### 2. **Verificación Automática**

Después de la solución:
- ✅ El bot se inicializa automáticamente al reiniciar el servidor (si hay sesión guardada)
- ✅ El bot se restaura automáticamente cuando hay mensajes pendientes
- ✅ Los errores son más visibles en los logs

### 3. **Monitoreo**

**Logs a revisar**:
```
[WhatsAppQueueProcessor] Procesando X mensajes pendientes
[WhatsAppQueueProcessor] Bot no conectado para tienda {storeId}...
[WhatsAppQueueProcessor] Bot restaurado exitosamente para tienda {storeId}
[WhatsAppQueueProcessor] Mensaje {id} enviado exitosamente a {phone}
[WhatsAppQueueProcessor] Error enviando mensaje {id} a {phone}: {error}
```

---

## 📋 Checklist de Verificación

- [ ] Bot inicializado manualmente al menos una vez
- [ ] Sesión guardada en `whatsapp-sessions/{store_id}/`
- [ ] Bot aparece como conectado en `/whatsapp/status`
- [ ] Mensajes pendientes se procesan cada 30 segundos
- [ ] Logs muestran intentos de envío
- [ ] Errores son visibles en logs (nivel WARN)

---

## ⚠️ Problemas Comunes

### 1. **Bot No Se Conecta Después de Reiniciar**

**Causa**: Sesión expirada o inválida

**Solución**:
1. Ir a configuración de WhatsApp
2. Hacer clic en "Desconectar" y luego "Inicializar Bot"
3. Escanear nuevo QR code

### 2. **Mensajes Quedan en "retrying" Indefinidamente**

**Causa**: Bot no conectado y sin sesión guardada

**Solución**:
1. Verificar estado: `GET /whatsapp/status`
2. Si `isConnected: false`, inicializar bot manualmente
3. Los mensajes se procesarán automáticamente una vez conectado

### 3. **Mensajes Marcados como "failed"**

**Causa**: Máximo de intentos alcanzado (3 por defecto)

**Solución**:
1. Verificar `error_message` en la tabla `whatsapp_message_queue`
2. Corregir el problema (bot desconectado, número inválido, etc.)
3. Resetear estado manualmente:
   ```sql
   UPDATE whatsapp_message_queue 
   SET status = 'pending', attempts = 0, error_message = NULL
   WHERE status = 'failed' AND store_id = '{store_id}';
   ```

---

## 🎯 Mejoras Futuras (Opcional)

1. **Endpoint para resetear mensajes fallidos**
2. **Dashboard de estado de mensajes**
3. **Notificaciones cuando bot se desconecta**
4. **Reintento automático con backoff exponencial**

---

**Última actualización**: 2026-01-23
