# ⏰ Cron Jobs Automáticos - ML Notifications System

## ✅ Cron Jobs Activos

El sistema de notificaciones ML ahora ejecuta **automáticamente** las siguientes tareas:

---

### 1. 🤖 Procesamiento ML Insights (Cada Hora)

**Horario**: Cada hora (ej: 9:00, 10:00, 11:00...)
**Función**: `processMLInsightsHourly()`
**Ubicación**: [queue-manager.service.ts:105](apps/api/src/notifications/services/queue-manager.service.ts#L105)

**¿Qué hace?**
- Obtiene todas las tiendas activas de la base de datos
- Para cada tienda, analiza:
  - 🔥 Predicciones de demanda (productos "on fire")
  - ⚠️ Riesgo de desabasto
  - 📉 Productos con baja rotación
  - 🚨 Anomalías detectadas por ML
  - 🎯 Oportunidades de cross-selling
- Genera insights automáticamente
- Crea notificaciones relevantes
- Las envía por los canales configurados (Email, Push, In-App)

**Ejemplo de logs**:
```
🤖 Hourly ML insights processing triggered
Processing ML insights for 5 stores
✅ Scheduled ML insights processing for 5 stores
```

---

### 2. 📧 Procesamiento de Cola de Emails (Cada 5 Minutos)

**Horario**: Cada 5 minutos (ej: 9:00, 9:05, 9:10...)
**Función**: `processEmailQueueCron()`
**Ubicación**: [queue-manager.service.ts:129](apps/api/src/notifications/services/queue-manager.service.ts#L129)

**¿Qué hace?**
- Revisa la cola `email_queue` en la base de datos
- Procesa emails pendientes en orden de prioridad
- Envía hasta 50 emails por lote (configurable)
- Maneja reintentos automáticos en caso de fallo
- Actualiza el estado de cada email (enviado, fallido, etc.)

**Ejemplo de logs**:
```
📧 Email queue processing triggered
✅ Email queue processing job scheduled
```

---

### 3. 📊 Generación de Digests Diarios (8:00 AM - Hora Bolivia)

**Horario**: 8:00 AM (Zona horaria: America/La_Paz)
**Función**: `generateDailyDigestsCron()`
**Ubicación**: [queue-manager.service.ts:154](apps/api/src/notifications/services/queue-manager.service.ts#L154)

**¿Qué hace?**
- Obtiene todas las tiendas activas
- Para cada tienda, genera un resumen diario con:
  - Top insights del día anterior
  - Productos con alta demanda
  - Alertas críticas
  - Anomalías detectadas
  - Recomendaciones ML
  - Métricas de performance de modelos
- Envía el digest por email a los managers de cada tienda

**Ejemplo de digest**:
```
🌅 Buenos días, Manager
Resumen diario LA-CAJA - 7 de Enero 2026

📈 Highlights:
- 3 productos en alta demanda detectados
- 2 alertas de desabasto
- 5 oportunidades de cross-selling

🎯 Top Acción Recomendada:
Coca-Cola 2L - Aumentar stock (92% confianza)
```

**Ejemplo de logs**:
```
📊 Daily digests generation triggered (8:00 AM Bolivia)
Generating daily digests for 5 stores
✅ Scheduled daily digests for 5 stores
```

---

### 4. 🧹 Limpieza de Trabajos Antiguos (Medianoche)

**Horario**: 00:00 (Medianoche)
**Función**: `cleanupOldJobs()`
**Ubicación**: [queue-manager.service.ts:216](apps/api/src/notifications/services/queue-manager.service.ts#L216)

**¿Qué hace?**
- Limpia trabajos **completados** más antiguos de **7 días**
- Limpia trabajos **fallidos** más antiguos de **30 días**
- Mantiene la cola Redis liviana y optimizada
- Previene acumulación de datos innecesarios

**Ejemplo de logs**:
```
🧹 Cleaning up old jobs (Midnight)
✅ Cleanup completed: 127 completed, 5 failed jobs removed
```

---

## 📋 Resumen de Horarios

| Tarea | Frecuencia | Horario | Zona Horaria |
|-------|-----------|---------|--------------|
| **ML Insights** | Cada hora | :00 | Sistema |
| **Email Queue** | Cada 5 min | :00, :05, :10... | Sistema |
| **Daily Digest** | Diario | 08:00 | America/La_Paz |
| **Cleanup** | Diario | 00:00 | Sistema |

---

## 🔧 Configuración

### Activar/Desactivar Cron Jobs

Los cron jobs están **activados por defecto**. Si necesitas desactivar alguno:

**Opción 1**: Comentar el decorador `@Cron()`

```typescript
// @Cron(CronExpression.EVERY_HOUR)
async processMLInsightsHourly() {
  // ...
}
```

**Opción 2**: Agregar variable de entorno

```env
# En .env
DISABLE_ML_CRON=true
```

Luego en el código:
```typescript
@Cron(CronExpression.EVERY_HOUR)
async processMLInsightsHourly() {
  if (process.env.DISABLE_ML_CRON === 'true') return;
  // ...
}
```

---

## 📊 Monitorear Cron Jobs

### Ver Logs en Tiempo Real

```bash
# En desarrollo
npm run dev

# En producción (Render)
# Dashboard → API Service → Logs
```

Busca estos emojis en los logs:
- 🤖 = ML Insights processing
- 📧 = Email queue processing
- 📊 = Daily digest generation
- 🧹 = Cleanup jobs
- ✅ = Success
- ❌ = Error

### Verificar Estado de la Cola

**Endpoint**: `GET /ml-notifications/queue/stats`

```bash
curl http://localhost:3000/ml-notifications/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta**:
```json
{
  "success": true,
  "stats": {
    "waiting": 5,
    "active": 2,
    "completed": 127,
    "failed": 1,
    "delayed": 0
  }
}
```

---

## ⚙️ Ajustar Horarios

### Cambiar Frecuencia de ML Insights

```typescript
// De cada hora a cada 30 minutos
@Cron('*/30 * * * *')
async processMLInsightsHourly() {
  // ...
}

// O cada 2 horas
@Cron('0 */2 * * *')
async processMLInsightsHourly() {
  // ...
}
```

### Cambiar Horario del Digest

```typescript
// De 8 AM a 9 AM
@Cron('0 9 * * *', {
  timeZone: 'America/La_Paz',
})
async generateDailyDigestsCron() {
  // ...
}

// Múltiples horarios (8 AM y 6 PM)
@Cron('0 8,18 * * *', {
  timeZone: 'America/La_Paz',
})
```

### Cambiar Frecuencia de Email Queue

```typescript
// De cada 5 min a cada minuto (más agresivo)
@Cron(CronExpression.EVERY_MINUTE)

// O cada 10 minutos (más conservador)
@Cron('*/10 * * * *')
```

---

## 🚨 Troubleshooting

### Cron Jobs No Se Ejecutan

**Verificar**:
1. ✅ `ScheduleModule.forRoot()` está importado en `notifications.module.ts`
2. ✅ El servidor está corriendo (no solo compilado)
3. ✅ No hay errores en los logs al inicio

**Solución**:
```bash
# Reiniciar servidor
npm run dev
```

### Trabajos Se Acumulan en la Cola

**Síntoma**: `waiting` aumenta constantemente en `/queue/stats`

**Causas posibles**:
- Redis desconectado
- Processor no está procesando trabajos
- Error en el procesador

**Solución**:
```bash
# 1. Verificar Redis conectado
# Ver logs del servidor - debe decir "BullMQ connected"

# 2. Limpiar cola manualmente si es necesario
# En Render Redis Dashboard → Flush Database (⚠️ cuidado en producción)
```

### Emails No Se Envían

**Verificar**:
1. ✅ `RESEND_API_KEY` configurada
2. ✅ Email queue tiene trabajos: `GET /ml-notifications/email/stats`
3. ✅ Cron de email queue se está ejecutando (logs cada 5 min)

**Ver estado**:
```bash
curl http://localhost:3000/ml-notifications/email/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 💡 Mejores Prácticas

### 1. Monitorear Regularmente
- Revisa logs diariamente (al menos en las primeras semanas)
- Configura alertas si `failed` jobs > 10

### 2. Ajustar Según Volumen
- **Pocas tiendas (1-5)**: Cada hora está bien
- **Muchas tiendas (50+)**: Considera cada 2-3 horas

### 3. Testing en Desarrollo
```bash
# Forzar ejecución inmediata sin esperar el cron
curl -X POST http://localhost:3000/ml-notifications/process/immediate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Producción en Render
- Redis debe estar en la misma región que la API
- Usar Redis **Starter** ($7/mes) mínimo para producción
- Monitorear memoria de Redis

---

## ✅ ¡Sistema Totalmente Automático!

Una vez que el servidor esté corriendo con Redis conectado:

- ✅ **No necesitas hacer nada manualmente**
- ✅ El sistema genera insights cada hora automáticamente
- ✅ Envía notificaciones relevantes a los managers
- ✅ Procesa emails en segundo plano
- ✅ Envía digests diarios a las 8 AM
- ✅ Se limpia automáticamente

**¡Tu sistema POS ahora tiene inteligencia artificial trabajando 24/7!** 🚀

---

## 📞 Soporte

Si algo no funciona:
1. Revisa los logs del servidor
2. Verifica `/queue/stats`
3. Confirma que Redis está conectado
4. Revisa este documento

**¿Todo funcionando?** ¡Perfecto! Ahora solo relájate y deja que el ML haga su magia. ✨
