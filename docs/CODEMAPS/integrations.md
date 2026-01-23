# Integrations Codemap - LA-CAJA

**Última Actualización:** 2026-01-22

---

## Servicios Externos

### Base de Datos

**PostgreSQL**
- **Ubicación:** Variable de entorno `DATABASE_URL`
- **Uso:** Base de datos principal
- **ORM:** TypeORM
- **RLS:** Habilitado para multi-tenant

### Caché y Búsqueda (Opcional)

**Redis**
- **Ubicación:** Variable de entorno `REDIS_URL`
- **Uso:** Caché distribuido, búsqueda semántica
- **Estado:** Opcional (no crítico)

### Colas de Trabajo

**BullMQ**
- **Ubicación:** Redis (requerido si se usa BullMQ)
- **Uso:** Colas de trabajos asíncronos
- **Módulos:** Notifications, WhatsApp

### WebSockets

**Socket.IO**
- **Uso:** Tiempo real (analytics, notificaciones)
- **Módulos:** `realtime-analytics`, `notifications`

### Email

**Resend**
- **Ubicación:** Variable de entorno `RESEND_API_KEY`
- **Uso:** Envío de emails
- **Módulo:** `notifications/services/email.service.ts`

### WhatsApp

**Baileys (@whiskeysockets/baileys)**
- **Uso:** Integración WhatsApp
- **Módulo:** `whatsapp/whatsapp-bot.service.ts`

### Autenticación

**JWT (JSON Web Tokens)**
- **Algoritmo:** HS256
- **Secret:** Variable de entorno `JWT_SECRET`
- **Expiración:** 7 días (configurable)
- **Refresh Tokens:** Implementados con rotación

---

## APIs Externas

### SENIAT (Fiscal - Mock)

**Estado:** Mock implementado

**Módulo:** `fiscal-invoices/seniat-integration.service.ts`

**Endpoints Mock:**
- Validación de RIF
- Emisión de facturas
- Consulta de facturas

---

## Configuración

### Variables de Entorno Requeridas

```bash
# Base de datos
DATABASE_URL=postgresql://...

# Autenticación
JWT_SECRET=...
ADMIN_SECRET=...

# Email (opcional)
RESEND_API_KEY=...

# Redis (opcional)
REDIS_URL=...

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://...
```

---

## Dependencias de Terceros

### Backend

- **@nestjs/platform-fastify** - Servidor HTTP
- **typeorm** - ORM
- **pg** - Driver PostgreSQL
- **bullmq** - Colas
- **socket.io** - WebSockets
- **resend** - Email
- **@whiskeysockets/baileys** - WhatsApp

### Frontend

- **axios** - HTTP client
- **dexie** - IndexedDB
- **@tanstack/react-query** - Data fetching
- **zustand** - State management
- **socket.io-client** - WebSockets cliente

---

**Ver también:**
- [Backend Codemap](./backend.md)
- [Frontend Codemap](./frontend.md)
