# 🏠 Guía de Producción en Máquina Local

## ✅ ¿Puede funcionar tu máquina local para producción?

**SÍ**, tu máquina es más que suficiente:
- **Ryzen 7 5700X** (8 cores/16 threads) - Excelente para producción
- **32GB RAM DDR4 3600MHz** - Sobrado para múltiples servicios
- **Sin límites de recursos** - Mejor que Render Free Tier

---

## 📋 Checklist de Configuración para Producción Local

### 1. **Acceso desde Internet** 🌐

#### Opción A: IP Pública Estática (Recomendado)
- **Ventaja**: Acceso directo, sin intermediarios
- **Requisito**: IP pública estática de tu ISP
- **Configuración**:
  1. Configurar port forwarding en router (puerto 443 → tu máquina)
  2. Configurar firewall local (macOS Firewall)
  3. Usar dominio con DNS A record apuntando a tu IP

#### Opción B: Tunnel (Más Fácil)
- **Cloudflare Tunnel** (gratis, sin IP pública necesaria)
- **ngrok** (gratis con límites, pago para producción)
- **Tailscale** (VPN mesh, gratis para uso personal)

#### Opción C: VPN (Más Seguro)
- **WireGuard** o **OpenVPN**
- Acceso solo desde clientes autorizados
- Ideal para tiendas físicas

---

### 2. **SSL/HTTPS** 🔒

**CRÍTICO**: Tu sistema POS maneja datos sensibles, HTTPS es obligatorio.

#### Opción A: Let's Encrypt (Gratis)
```bash
# Instalar certbot
brew install certbot

# Obtener certificado (requiere dominio y puerto 80/443 abierto)
sudo certbot certonly --standalone -d tu-dominio.com

# Renovar automáticamente
sudo certbot renew --dry-run
```

#### Opción B: Cloudflare Tunnel (Incluye SSL automático)
- SSL automático sin configuración
- No necesitas abrir puertos

#### Opción C: Nginx Reverse Proxy con SSL
```nginx
server {
    listen 443 ssl http2;
    server_name tu-dominio.com;
    
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### 3. **Proceso Manager (PM2)** 🔄

**Instalar PM2**:
```bash
npm install -g pm2
```

**Crear `ecosystem.config.js`**:
```javascript
module.exports = {
  apps: [
    {
      name: 'la-caja-api',
      script: 'dist/main.js',
      cwd: '/Users/yoeldev/Documents/GitHub/LA-CAJA/apps/api',
      instances: 2, // Usar 2 cores (tienes 8, puedes usar más)
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G', // Reiniciar si usa más de 1GB
    },
  ],
};
```

**Comandos útiles**:
```bash
# Iniciar
pm2 start ecosystem.config.js

# Ver estado
pm2 status

# Ver logs
pm2 logs la-caja-api

# Reiniciar
pm2 restart la-caja-api

# Detener
pm2 stop la-caja-api

# Iniciar al arrancar sistema
pm2 startup
pm2 save
```

#### 3.1 **WhatsApp – Persistencia en producción** 📱

Para que la sesión de WhatsApp **sobreviva a reinicios** (deploy, PM2 restart, reinicio del servidor):

1. **Directorio `whatsapp-sessions/`**  
   La API guarda credenciales en `apps/api/whatsapp-sessions/{store_id}/`. Ese directorio debe **persistir** entre reinicios:
   - **PM2 en servidor físico/VPS**: por defecto ya es persistente; evita borrar `apps/api/whatsapp-sessions`.
   - **Docker**: monta un volumen en el directorio donde la API escribe `whatsapp-sessions` (p. ej. `process.cwd()/whatsapp-sessions`),  
     p. ej. `-v /data/wa-sessions:/app/whatsapp-sessions` (ajusta `/app` al cwd del proceso en el contenedor).
   - **Render / Railway / Heroku**: el disco suele ser efímero; si se recrea el contenedor, se pierde la sesión y habrá que escanear el QR de nuevo. En esos entornos, valora usar un disco persistente o almacenamiento externo si lo ofrecen.

2. **Arranque y reconexión automática**  
   - Al iniciar, se restauran bots de tiendas con WhatsApp habilitado y sesión guardada.
   - Cada 5 minutos se intenta reconectar bots que estén desconectados.

3. **PM2 con varias instancias**  
   Si usas `instances > 1` en cluster, solo una sesión de WhatsApp por número es válida. Conviene usar `instances: 1` para la API cuando dependas de WhatsApp, o ejecutar un solo worker que corra el módulo de WhatsApp.

---

### 4. **Variables de Entorno de Producción** 🔐

**Crear `apps/api/.env.production`**:
```env
NODE_ENV=production
PORT=3000

# Base de datos (usar Supabase o PostgreSQL local)
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT - CAMBIAR EN PRODUCCIÓN
JWT_SECRET=GENERAR_SECRET_SEGURO_DE_64_CARACTERES_MINIMO
JWT_EXPIRES_IN=24h

# Admin Secret - CAMBIAR
ADMIN_SECRET=GENERAR_SECRET_SEGURO_DE_64_CARACTERES

# Redis (usar Redis Cloud o local)
REDIS_URL=redis://:password@host:port

# CORS - Solo dominios permitidos
ALLOWED_ORIGINS=https://tu-dominio.com,https://app.tu-dominio.com
ALLOW_ALL_ORIGINS_LOCAL=false

# SSL
DB_SSL_REJECT_UNAUTHORIZED=true

# Pool de conexiones (producción)
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_CONNECTION_TIMEOUT=10000

# Rate Limiting
THROTTLE_LIMIT=100
THROTTLE_TTL=60

# Email
RESEND_API_KEY=tu-api-key
EMAIL_FROM=noreply@tu-dominio.com
EMAIL_FROM_NAME=LA-CAJA

# VAPID Keys (Push Notifications)
VAPID_PUBLIC_KEY=tu-public-key
VAPID_PRIVATE_KEY=tu-private-key
VAPID_SUBJECT=mailto:admin@tu-dominio.com
```

**Generar secrets seguros**:
```bash
# JWT Secret (64 caracteres)
openssl rand -hex 32

# Admin Secret (64 caracteres)
openssl rand -hex 32
```

---

### 5. **Firewall (macOS)** 🛡️

**Configurar firewall**:
```bash
# Habilitar firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Permitir Node.js
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node

# Permitir puerto 3000 (solo si no usas reverse proxy)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

**O usar GUI**: System Preferences → Security & Privacy → Firewall

---

### 6. **Monitoreo y Logs** 📊

#### Opción A: PM2 Monitoring (Gratis)
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### Opción B: Sentry (Errores)
- Integrar Sentry para tracking de errores
- Configurar en `main.ts`

#### Opción C: Prometheus + Grafana (Métricas)
- Tu app ya tiene `/metrics` endpoint
- Instalar Prometheus local
- Dashboard con Grafana

---

### 7. **Backups Automáticos** 💾

**Script de backup** (`scripts/backup.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/Users/yoeldev/backups/la-caja"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="postgres"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Backup de base de datos (Supabase)
# Usar pg_dump con DATABASE_URL
pg_dump $DATABASE_URL > $BACKUP_DIR/db_$DATE.sql

# Comprimir
gzip $BACKUP_DIR/db_$DATE.sql

# Mantener solo últimos 30 días
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completado: db_$DATE.sql.gz"
```

**Cron job** (diario a las 2 AM):
```bash
# Editar crontab
crontab -e

# Agregar línea
0 2 * * * /Users/yoeldev/Documents/GitHub/LA-CAJA/scripts/backup.sh
```

---

### 8. **Actualizaciones Automáticas** 🔄

**Script de deploy** (`scripts/deploy.sh`):
```bash
#!/bin/bash
set -e

cd /Users/yoeldev/Documents/GitHub/LA-CAJA

# Pull cambios
git pull origin main

# Instalar dependencias
npm install

# Build
npm run build:api

# Reiniciar PM2
pm2 restart la-caja-api

echo "Deploy completado"
```

**Cron para auto-update** (opcional, solo si confías en CI/CD):
```bash
# Cada hora verificar actualizaciones
0 * * * * /Users/yoeldev/Documents/GitHub/LA-CAJA/scripts/deploy.sh
```

---

### 9. **Uptime y Auto-restart** ⚡

**Configurar auto-restart en macOS**:

**Crear LaunchDaemon** (`~/Library/LaunchAgents/com.lacaja.api.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lacaja.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/pm2</string>
        <string>resurrect</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

**Cargar**:
```bash
launchctl load ~/Library/LaunchAgents/com.lacaja.api.plist
```

---

### 10. **Optimizaciones de Producción** 🚀

#### A. Aumentar pool de conexiones
```env
DB_POOL_MAX=20  # En producción
DB_POOL_MIN=2
```

#### B. Habilitar compresión
```typescript
// En main.ts
app.register(require('@fastify/compress'));
```

#### C. Cache de Redis
- Ya configurado con BullMQ
- Considerar cache de queries frecuentes

#### D. Rate Limiting más estricto
```env
THROTTLE_LIMIT=50  # Más conservador en producción
THROTTLE_TTL=60
```

---

## ⚠️ Consideraciones Importantes

### Ventajas ✅
- **Recursos ilimitados** (32GB RAM, 8 cores)
- **Sin costos** de hosting
- **Control total** sobre configuración
- **Mejor rendimiento** que Render Free Tier
- **Sin límites de tiempo** (no se duerme)

### Desventajas ⚠️
- **IP pública necesaria** o tunnel
- **Uptime depende de tu máquina** (apagones, reinicios)
- **Ancho de banda** limitado por tu conexión
- **Seguridad** depende de tu configuración
- **Backups** son tu responsabilidad
- **Monitoreo** requiere setup adicional

### Riesgos 🚨
1. **Apagón eléctrico**: Usar UPS (batería)
2. **Conexión a internet**: Backup con 4G/5G
3. **Ataques**: Firewall + rate limiting + fail2ban
4. **Hardware falla**: Backups en la nube

---

## 🎯 Recomendación Final

### Para Producción Real (Tiendas Activas):

**Opción 1: Híbrido (Recomendado)**
- **Local**: Desarrollo y testing
- **Cloud (Render/Heroku)**: Producción real
- **Ventaja**: Uptime garantizado, backups automáticos

**Opción 2: Local con Redundancia**
- **Máquina principal**: Tu Ryzen 7
- **Máquina secundaria**: Backup (otra PC o VPS pequeño)
- **Load balancer**: Cloudflare (gratis)
- **Ventaja**: Control total + redundancia

**Opción 3: Solo Local (Para MVP/Testing)**
- **Ideal para**: Validación con pocos usuarios
- **Requisitos**: UPS, backup automático, monitoreo
- **Ventaja**: Sin costos, máximo control

---

## 📝 Checklist de Lanzamiento

Antes de poner en producción:

- [ ] SSL/HTTPS configurado
- [ ] Variables de entorno de producción
- [ ] Secrets cambiados (JWT, ADMIN_SECRET)
- [ ] CORS configurado (solo dominios permitidos)
- [ ] Firewall configurado
- [ ] PM2 configurado con auto-restart
- [ ] Backups automáticos configurados
- [ ] Monitoreo configurado (logs, errores)
- [ ] Rate limiting activado
- [ ] Health checks funcionando (`/health`)
- [ ] Base de datos optimizada (índices, pool)
- [ ] Redis configurado
- [ ] Dominio configurado (DNS)
- [ ] Pruebas de carga realizadas
- [ ] Plan de recuperación documentado

---

## 🚀 Comandos Rápidos

```bash
# Build para producción
npm run build:api

# Iniciar con PM2
pm2 start ecosystem.config.js --env production

# Ver logs en tiempo real
pm2 logs la-caja-api

# Monitoreo
pm2 monit

# Reiniciar después de cambios
pm2 restart la-caja-api

# Verificar salud
curl https://tu-dominio.com/health
```

---

## 📚 Recursos Adicionales

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [macOS Firewall Guide](https://support.apple.com/guide/mac-help/use-the-application-firewall-mh34041/mac)

---

**¿Necesitas ayuda configurando algo específico?** Pregunta y te ayudo a implementarlo.
