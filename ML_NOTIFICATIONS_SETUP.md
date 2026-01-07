# 🚀 Sistema de Notificaciones Inteligentes ML-Driven

## 📋 Resumen del Sistema

Has implementado exitosamente un **sistema de notificaciones empresarial top tier** impulsado por Machine Learning que transforma tus predicciones, anomalías y recomendaciones en notificaciones inteligentes y accionables.

### ✨ Características Principales

#### 🤖 Notificaciones Inteligentes Automáticas

1. **🔥 Productos "On Fire"** - Alta demanda detectada
   - Trigger: `confidence >= 80% AND predicted > stock * 1.5`
   - Canales: Email, Push, In-App
   - Acciones: Ver análisis, aumentar stock

2. **⚠️ Alertas de Desabasto** - Riesgo de quedarse sin stock
   - Trigger: `current_stock < predicted_demand AND confidence >= 70%`
   - Incluye: Días hasta desabasto, revenue en riesgo, orden recomendada
   - Severidad: Critical si quedan ≤2 días

3. **📉 Baja Rotación** - Productos con poco movimiento
   - Trigger: `predicted < 5 AND stock > 50 AND overstock_ratio > 10`
   - Sugerencias: Promociones, liquidación, bundles

4. **🚨 Anomalías Críticas** - Detección ensemble ML
   - Isolation Forest + Statistical Detection
   - Severidades: Low, Medium, High, Critical
   - Auto-notificación para critical/high

5. **🎯 Cross-Selling Inteligente** - Oportunidades de venta
   - Basado en recomendaciones colaborativas
   - Score > 75% = alta probabilidad
   - Sugerencias de bundles automáticos

6. **🎁 Digest Diario** - Resumen personalizado
   - Agregación de insights del día
   - Enviado automáticamente a las 8 AM
   - Performance de modelos ML

---

## 🏗️ Arquitectura Implementada

```
┌──────────────────────────────────────────────────┐
│         ML Insights Engine                       │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐        │
│  │ Demand  │  │Anomaly  │  │Recommend │        │
│  │Forecast │  │Detector │  │  Engine  │        │
│  └────┬────┘  └────┬────┘  └────┬─────┘        │
└───────┼───────────┼────────────┼───────────────┘
        │           │            │
   ┌────▼───────────▼────────────▼────┐
   │  Notification Orchestrator        │
   │  - Smart Triggers                 │
   │  - Template Rendering             │
   │  - Rate Limiting                  │
   └────┬──────────┬──────────┬────────┘
        │          │          │
   ┌────▼──┐  ┌───▼───┐  ┌──▼────┐
   │BullMQ │  │Redis  │  │Resend │
   │Queue  │  │Cache  │  │Email  │
   └───────┘  └───────┘  └───────┘
        │          │          │
   ┌────▼──────────▼──────────▼────┐
   │   Multi-Channel Delivery       │
   │   Email│Push│WebSocket│In-App  │
   └────────────────────────────────┘
```

---

## 📦 Archivos Creados

### Backend (NestJS)

#### Migraciones y Entidades
- ✅ `src/database/migrations/36_ml_notifications_system.sql` - Migración completa
  - 8 tablas nuevas
  - 5 templates por defecto
  - Views y triggers

- ✅ `src/database/entities/notification-template.entity.ts`
- ✅ `src/database/entities/ml-insight.entity.ts`
- ✅ `src/database/entities/notification-analytics.entity.ts`
- ✅ `src/database/entities/email-queue.entity.ts`

#### Servicios
- ✅ `src/notifications/services/ml-insights.service.ts` - Genera insights desde ML
- ✅ `src/notifications/services/template.service.ts` - Templates con Handlebars + i18n
- ✅ `src/notifications/services/email.service.ts` - Integración Resend
- ✅ `src/notifications/services/notification-orchestrator.service.ts` - Cerebro del sistema
- ✅ `src/notifications/services/rate-limiter.service.ts` - Anti-fatiga inteligente
- ✅ `src/notifications/services/analytics.service.ts` - Métricas avanzadas
- ✅ `src/notifications/services/queue-manager.service.ts` - Gestión de colas

#### Controllers y Queues
- ✅ `src/notifications/ml-notifications.controller.ts` - REST API
- ✅ `src/notifications/queues/notifications.queue.ts` - Procesador BullMQ
- ✅ `src/notifications/notifications.module.ts` - Módulo actualizado

---

## 🔧 Setup e Instalación

### 1. Ejecutar Migración SQL

```bash
# Opción A: Usando psql (si está instalado)
cd apps/api
PGPASSWORD='@bC154356' psql \
  -h aws-1-us-east-1.pooler.supabase.com \
  -U postgres.unycbbictuwzruxshacq \
  -d postgres \
  -p 5432 \
  -f src/database/migrations/36_ml_notifications_system.sql

# Opción B: Copiar y ejecutar en Supabase SQL Editor
# 1. Abre: https://supabase.com/dashboard/project/_/sql/new
# 2. Copia el contenido de: src/database/migrations/36_ml_notifications_system.sql
# 3. Ejecuta el script
```

### 2. Configurar Redis (para BullMQ)

#### Opción A: Redis en Render (Recomendado para Producción) 🚀

1. **Crear Redis Instance en Render**:
   - Ve a [Render Dashboard](https://dashboard.render.com)
   - Click en **"New +"** → **"Redis"**
   - Selecciona un plan (tienen Free tier)
   - Render te dará una URL como: `redis://red-xxxxx:6379`

2. **Configurar en Render**:
   - Ve a tu servicio API en Render
   - **Environment** → **Add Environment Variable**
   - Agrega:
     ```
     REDIS_URL=redis://red-xxxxx:6379
     ```
   - ✅ El sistema detectará automáticamente `REDIS_URL` y la usará

#### Opción B: Redis Local (Desarrollo)

```bash
# macOS
brew install redis
brew services start redis

# O usar Docker
docker run -d -p 6379:6379 redis:alpine

# Verificar
redis-cli ping
# Debe responder: PONG
```

**Configurar en `.env`**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 3. Configurar Variables de Entorno

Actualiza `apps/api/.env`:

```env
# Resend Email Service (IMPORTANTE)
RESEND_API_KEY=re_tu_api_key_aqui  # Obtener en: https://resend.com/api-keys
EMAIL_FROM=noreply@tu-dominio.com
EMAIL_FROM_NAME=LA-CAJA

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Dejar vacío si es local sin password
```

### 4. Obtener API Key de Resend

1. Ve a: https://resend.com
2. Crea una cuenta (100 emails/día gratis)
3. Genera un API Key
4. Agrégala al `.env`

### 5. Iniciar Servidor

```bash
cd apps/api
npm run dev
```

---

## 🎮 Usando el Sistema

### API Endpoints Disponibles

#### Generar Insights de ML
```bash
POST /ml-notifications/insights/generate
Authorization: Bearer {token}

# Respuesta:
{
  "success": true,
  "total": 15,
  "insights": [...]
}
```

#### Procesar Insights y Crear Notificaciones
```bash
# Inmediato (sincrónico)
POST /ml-notifications/process/immediate

# Asíncrono (recomendado)
POST /ml-notifications/process
```

#### Obtener Insights Activos
```bash
GET /ml-notifications/insights?type=demand_forecast&severity=high&limit=10
```

#### Resolver un Insight
```bash
PATCH /ml-notifications/insights/{id}/resolve
{
  "note": "Stock aumentado exitosamente"
}
```

#### Analytics de Engagement
```bash
GET /ml-notifications/analytics/engagement?from=2024-01-01&to=2024-01-31
GET /ml-notifications/analytics/channels
GET /ml-notifications/analytics/ml-insights
GET /ml-notifications/analytics/top-performing?limit=10
GET /ml-notifications/analytics/trends?days=30
```

#### Registrar Interacción
```bash
POST /ml-notifications/analytics/interaction
{
  "notificationId": "uuid",
  "type": "clicked",  // opened | clicked | dismissed | action
  "actionTaken": "view_product"
}
```

#### Generar Digest Diario Manual
```bash
POST /ml-notifications/digest/generate
```

#### Estadísticas
```bash
GET /ml-notifications/email/stats
GET /ml-notifications/queue/stats
GET /ml-notifications/rate-limit/stats
```

---

## 🤖 Automatización

### Cron Jobs Configurados

El sistema incluye **cron jobs automáticos**:

1. **Cada hora**: Procesar insights ML (comentado por defecto)
2. **Cada 5 minutos**: Procesar cola de emails
3. **8:00 AM diario**: Generar digests diarios (comentado por defecto)
4. **Medianoche**: Limpiar trabajos antiguos

Para activarlos, descomenta el código en `queue-manager.service.ts`.

---

## 📊 Tablas de Base de Datos

### Nuevas Tablas Creadas

1. **notification_templates** - Templates dinámicos multi-idioma
2. **ml_insights** - Insights generados por ML
3. **notification_analytics** - Tracking de engagement
4. **notification_rate_limits** - Control de frecuencia
5. **ml_notification_rules** - Motor de reglas
6. **email_queue** - Cola de emails Resend
7. **Views**: `notification_engagement_metrics`, `ml_insights_summary`

---

## 🎯 Flujo de Trabajo Típico

### 1. Generación Automática de Insights

```typescript
// El MLInsightsService analiza:
- Predicciones de demanda recientes (confidence >= 70%)
- Anomalías no resueltas (últimas 24 horas)
- Recomendaciones de alta confianza (score >= 75%)

// Genera insights clasificados por:
- Tipo: demand_forecast, anomaly, recommendation, risk, opportunity, trend
- Severidad: low, medium, high, critical
- Prioridad: 0-100 (calculada automáticamente)
```

### 2. Orquestación de Notificaciones

```typescript
// El Orchestrator:
1. Recibe insights del MLInsightsService
2. Determina template apropiado
3. Identifica usuarios objetivo (managers)
4. Renderiza template con variables ML
5. Verifica rate limits
6. Entrega por canales configurados
7. Registra analytics
```

### 3. Entrega Multi-Canal

```typescript
// Canales según severidad:
critical → Email + Push + In-App + WebSocket
high → Push + In-App + WebSocket
medium → In-App + WebSocket
low → In-App
```

---

## 📈 Métricas y Analytics

### Métricas Disponibles

**Engagement**:
- Total enviadas
- Tasa de apertura (open rate)
- Tasa de clicks (click rate)
- Tasa de acciones (action rate)
- Tiempo promedio hasta abrir
- Tiempo promedio hasta acción

**Por Canal**:
- Delivery rate
- Open rate
- Click rate
- Por cada canal: email, push, in_app, websocket

**ML Insights**:
- Total generados
- Por tipo y severidad
- Notificaciones enviadas
- Insights accionables
- Insights resueltos
- Confianza promedio

---

## 🎨 Templates Incluidos

### Templates Pre-configurados

1. **demand_high** - Producto en alta demanda
2. **stock_alert** - Riesgo de desabasto
3. **anomaly_critical** - Anomalía crítica
4. **ml_recommendation** - Oportunidad cross-selling
5. **ml_daily_digest** - Resumen diario

### Ejemplo de Template

```json
{
  "template_key": "demand_high",
  "content": {
    "es": {
      "title": "🔥 {{productName}} está en alta demanda",
      "body": "Demanda predicha: {{predicted}} unidades ({{confidence}}% confianza). Considera aumentar stock."
    },
    "en": {
      "title": "🔥 {{productName}} is in high demand",
      "body": "Predicted demand: {{predicted}} units ({{confidence}}% confidence). Consider increasing stock."
    }
  },
  "email_template": "<h1>🔥 {{productName}} is on Fire!</h1>..."
}
```

---

## 🔐 Rate Limiting

### Límites por Defecto

- **Por hora**: 10 notificaciones
- **Por día**: 50 notificaciones
- **Por semana**: 200 notificaciones

### Override para Críticas

Las notificaciones con prioridad `urgent` o `critical` **bypass** los límites (configurable).

---

## 🧪 Testing

### Test Manual Rápido

```bash
# 1. Generar insights
curl -X POST http://localhost:3000/ml-notifications/insights/generate \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Ver insights generados
curl http://localhost:3000/ml-notifications/insights \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Procesar y crear notificaciones
curl -X POST http://localhost:3000/ml-notifications/process/immediate \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Ver estadísticas
curl http://localhost:3000/ml-notifications/analytics/engagement \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🚨 Troubleshooting

### Redis Connection Error

```bash
# Verificar Redis
redis-cli ping

# Iniciar Redis
brew services start redis
# o
docker start redis
```

### Email No Enviado

```bash
# Verificar API key
GET /ml-notifications/email/status

# Verificar cola
GET /ml-notifications/email/stats
```

### Insights No Generados

```bash
# Verificar que existen predicciones ML
SELECT COUNT(*) FROM demand_predictions WHERE created_at >= NOW() - INTERVAL '7 days';

# Verificar anomalías
SELECT COUNT(*) FROM detected_anomalies WHERE resolved_at IS NULL;
```

---

## 📚 Próximos Pasos

### Frontend (Recomendado)

1. **Dashboard de ML Insights**
   - Visualización de insights activos
   - Gráficos de tendencias
   - Acciones rápidas

2. **Panel de Analytics**
   - Engagement metrics
   - Channel performance
   - ML performance

3. **Configuración de Templates**
   - Editor visual
   - Preview en tiempo real
   - Test de variables

### Backend (Opcional)

1. **SMS Integration** - Twilio/AWS SNS
2. **WhatsApp Notifications** - WhatsApp Business API
3. **Slack Integration** - Para equipos
4. **A/B Testing** - Optimización automática

---

## 💡 Casos de Uso Ejemplo

### Caso 1: Producto Viral

```
ML detecta: Demand predicted = 500, Current stock = 150, Confidence = 92%

→ Insight generado: "demand_forecast" severity="high"
→ Orchestrator crea notificación
→ Template renderizado: "🔥 Coca-Cola 2L está en alta demanda"
→ Enviado a: Store Manager
→ Canales: Email + Push + In-App
→ Analytics registra: opened_at, clicked_at, action_taken="reorder"
```

### Caso 2: Desabasto Inminente

```
ML detecta: Stock = 5, Predicted 7-day demand = 45, Confidence = 85%

→ Insight: "risk" severity="critical"
→ Days until stockout = 1
→ Lost revenue potential = Bs. 2,500
→ Email urgent + Push + In-App
→ Suggested action: "Reordenar 60 unidades"
```

### Caso 3: Cross-Selling

```
ML detecta: Customer bought "Pan", Recommendation "Mantequilla" score=88%

→ Insight: "recommendation" severity="medium"
→ In-App notification para cajero
→ "Sugerir Mantequilla (88% probabilidad)"
→ Si se acepta → Analytics registra conversión
```

---

## 📞 Soporte

Si encuentras issues:

1. Revisa logs del servidor
2. Verifica Redis está corriendo
3. Confirma migración SQL ejecutada
4. Chequea variables de entorno

---

## 🎉 ¡Sistema Listo!

Has implementado con éxito un **sistema de notificaciones empresarial de clase mundial** que:

✅ Genera insights inteligentes desde tus modelos ML
✅ Crea notificaciones automáticas relevantes
✅ Entrega por múltiples canales
✅ Previene fatiga con rate limiting
✅ Rastrea engagement completo
✅ Escala con colas asíncronas
✅ Soporta templates multi-idioma
✅ Envía emails profesionales con Resend

**¡Tu sistema POS ahora tiene notificaciones dignas de una empresa Fortune 500!** 🚀
