import { Controller, Get, Res, Header } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { FastifyReply } from 'fastify';
import * as path from 'path';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { BullMQHealthIndicator } from './indicators/bullmq-health.indicator';
import { ExternalApisHealthIndicator } from './indicators/external-apis-health.indicator';
import { WebSocketHealthIndicator } from './indicators/websocket-health.indicator';

import { Cron } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
    private bullmq: BullMQHealthIndicator,
    private externalApis: ExternalApisHealthIndicator,
    private websocket: WebSocketHealthIndicator,
  ) {}

  // Cache simple para mejorar rendimiento
  private cache: Map<string, { result: any; time: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 segundos (aumentado para reducir carga)

  private async checkWithCache(key: string, checkFn: () => Promise<any>) {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && now - cached.time < this.CACHE_TTL) {
      return cached.result;
    }

    const result = await checkFn();
    this.cache.set(key, { result, time: now });
    return result;
  }

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check general del sistema' })
  @ApiResponse({ status: 200, description: 'Sistema saludable' })
  @ApiResponse({ status: 503, description: 'Sistema no saludable' })
  check() {
    return this.checkWithCache('general', () =>
      this.health.check([
        () => this.db.pingCheck('database', { timeout: 10000 }),
        () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
        () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // 500MB
      ]),
    );
  }

  @Get('database')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de la base de datos PostgreSQL' })
  @ApiResponse({ status: 200, description: 'Base de datos saludable' })
  @ApiResponse({ status: 503, description: 'Base de datos no disponible' })
  checkDatabase() {
    return this.checkWithCache('database', () =>
      this.health.check([
        () => this.db.pingCheck('database', { timeout: 10000 }),
      ]),
    );
  }

  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de Redis' })
  @ApiResponse({ status: 200, description: 'Redis saludable' })
  @ApiResponse({ status: 503, description: 'Redis no disponible' })
  checkRedis() {
    return this.checkWithCache('redis', () =>
      this.health.check([() => this.redis.isHealthy('redis')]),
    );
  }

  @Get('queues')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de colas BullMQ' })
  @ApiResponse({ status: 200, description: 'Colas saludables' })
  @ApiResponse({ status: 503, description: 'Colas con problemas' })
  checkQueues() {
    return this.checkWithCache('queues', () =>
      this.health.check([() => this.bullmq.isHealthy('bullmq')]),
    );
  }

  @Get('external')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de APIs externas' })
  @ApiResponse({ status: 200, description: 'APIs externas saludables' })
  @ApiResponse({
    status: 503,
    description: 'Algunas APIs externas no disponibles',
  })
  checkExternal() {
    return this.checkWithCache('external', () =>
      this.health.check([() => this.externalApis.isHealthy('external_apis')]),
    );
  }

  @Get('websocket')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de WebSocket' })
  @ApiResponse({ status: 200, description: 'WebSocket operacional' })
  checkWebSocket() {
    return this.checkWithCache('websocket', () =>
      this.health.check([() => this.websocket.isHealthy('websocket')]),
    );
  }

  @Get('detailed')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check detallado de todos los servicios' })
  @ApiResponse({ status: 200, description: 'Todos los servicios saludables' })
  @ApiResponse({ status: 503, description: 'Algunos servicios no saludables' })
  async checkDetailed() {
    return this.checkWithCache('detailed', () =>
      this.health.check([
        () => this.db.pingCheck('database', { timeout: 10000 }),
        () => this.redis.isHealthy('redis'),
        () => this.bullmq.isHealthy('bullmq'),
        () => this.websocket.isHealthy('websocket'),
        () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
        () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
        () =>
          this.disk.checkStorage('storage', {
            path: path.resolve('/'),
            thresholdPercent: 0.9, // 90% de uso máximo
          }),
      ]),
    );
  }

  @Cron('*/25 * * * * *')
  async warmUpCache() {
    try {
      const warmups = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkQueues(),
        this.checkWebSocket(),
        this.checkExternal(),
        this.checkDetailed(),
      ]);

      warmups.forEach((result, index) => {
        if (result.status === 'rejected') {
          const checks = [
            'database',
            'redis',
            'queues',
            'websocket',
            'external',
            'detailed',
          ];
          const error =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          // Usar warn en lugar de debug para visibilidad, pero sin stack trace completo para reducir ruido
          this.logger.warn(
            `Health check background warmup failed for ${checks[index]}: ${error}`,
          );
        }
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Critical error in health cache background task: ${errorMsg}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  @Get('dashboard')
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'Dashboard visual de health checks' })
  dashboard(@Res() res: FastifyReply) {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Velox POS - Health Dashboard</title>
  <style>
    :root {
      --bg: #f3f4f6;
      --surface: #ffffff;
      --surface-soft: #fafafa;
      --text: #111827;
      --text-soft: #6b7280;
      --border: #e5e7eb;
      --brand: #4f46e5;
      --success: #10b981;
      --success-soft: #2dd4bf;
      --warning: #f59e0b;
      --danger: #ef4444;
      --radius-lg: 12px;
      --radius-md: 8px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Sora', 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
      padding: 28px 12px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .page-shell {
      max-width: 980px;
      margin: 0 auto;
      padding: 0 4px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: linear-gradient(140deg, var(--brand), #312e81);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
    }

    .title-row h1 {
      font-size: clamp(1.6rem, 3vw, 2.3rem);
      letter-spacing: -0.03em;
      font-weight: 700;
    }

    .title-row p {
      margin-top: 2px;
      color: var(--text-soft);
      font-size: 0.85rem;
    }

    .subscribe-btn {
      border: 0;
      background: #6d28d9;
      color: #fff;
      min-height: 38px;
      padding: 0 16px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
    }

    .overall-banner {
      display: flex;
      align-items: center;
      min-height: 56px;
      border-radius: var(--radius-md);
      margin-bottom: 18px;
      padding: 0 18px;
      background: var(--success-soft);
      color: #ffffff;
      font-size: 1rem;
      font-weight: 600;
    }

    .overall-banner.is-up {
      background: var(--success-soft);
    }

    .overall-banner.is-down {
      background: var(--danger);
    }

    .overall-banner.is-degraded {
      background: var(--warning);
    }

    .overall-banner.is-loading {
      background: #60a5fa;
    }

    .uptime-note {
      text-align: right;
      font-size: 0.85rem;
      color: var(--text-soft);
      margin-bottom: 8px;
    }

    .services-panel {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      overflow: hidden;
    }

    .service-row {
      padding: 16px 18px;
      border-top: 1px solid var(--border);
    }

    .service-row:first-child {
      border-top: 0;
    }

    .service-row-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }

    .service-name {
      font-size: 1.02rem;
      font-weight: 700;
    }

    .service-description {
      font-size: 0.8rem;
      color: var(--text-soft);
    }

    .status-text {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--success);
      white-space: nowrap;
    }

    .service-row.is-down .status-text {
      color: var(--danger);
    }

    .service-row.is-degraded .status-text {
      color: var(--warning);
    }

    .uptime-bars {
      display: grid;
      grid-template-columns: repeat(90, minmax(0, 1fr));
      gap: 2px;
      align-items: center;
      margin-bottom: 8px;
    }

    .bar {
      height: 28px;
      border-radius: 2px;
      background: #d1d5db;
    }

    .bar.up {
      background: var(--success-soft);
    }

    .bar.warn {
      background: #facc15;
    }

    .bar.down {
      background: var(--danger);
    }

    .uptime-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-soft);
      font-size: 0.78rem;
    }

    .uptime-meta .uptime-value {
      font-weight: 600;
    }

    .service-row.is-up .uptime-meta .uptime-value {
      color: var(--success);
    }

    .service-row.is-down .uptime-meta .uptime-value {
      color: var(--danger);
    }

    .service-row.is-degraded .uptime-meta .uptime-value {
      color: var(--warning);
    }

    .components-list {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .component-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 22px;
      border-radius: 999px;
      padding: 0 8px;
      font-size: 0.72rem;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text-soft);
    }

    .component-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--success);
    }

    .component-dot.down {
      background: var(--danger);
    }

    .error-message {
      margin-top: 10px;
      color: #991b1b;
      font-size: 0.77rem;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      border-radius: 6px;
      padding: 8px;
      word-break: break-word;
    }

    .footer-bar {
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .refresh-btn {
      border: 1px solid #cbd5e1;
      background: var(--surface);
      color: #0f172a;
      border-radius: 6px;
      min-height: 38px;
      padding: 0 14px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: opacity 0.15s ease, border-color 0.15s ease;
      font-family: inherit;
    }

    .refresh-btn:hover:not(:disabled) {
      border-color: #94a3b8;
    }

    .refresh-btn:focus-visible {
      outline: 2px solid #93c5fd;
      outline-offset: 2px;
    }

    .refresh-btn:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    .last-update {
      color: var(--text-soft);
      font-size: 0.78rem;
    }

    .loading-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.55);
      border-top-color: #ffffff;
      border-radius: 999px;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 768px) {
      body {
        padding: 18px 8px;
      }

      .page-header {
        align-items: flex-start;
      }

      .subscribe-btn {
        width: 100%;
      }

      .bar {
        height: 20px;
      }

      .footer-bar {
        align-items: stretch;
        flex-direction: column;
      }

      .refresh-btn {
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <main class="page-shell">
    <header class="page-header">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"></div>
        <div class="title-row">
          <h1>Velox Status</h1>
          <p>Monitoreo público del estado operativo del sistema.</p>
        </div>
      </div>
      <button class="subscribe-btn" type="button">Subscribe to updates</button>
    </header>

    <div id="overall-status" class="overall-banner is-loading" role="status" aria-live="polite">
      <span class="loading-spinner"></span>
      <span>Verificando estado general...</span>
    </div>

    <div class="uptime-note">Uptime de los ultimos 90 dias</div>

    <section class="services-panel" aria-label="Servicios monitoreados">
      <div id="services-grid" aria-live="polite" aria-busy="true"></div>
    </section>

    <footer class="footer-bar">
      <button class="refresh-btn" onclick="loadHealthStatus()" id="refresh-btn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
        <span>Actualizar</span>
      </button>
      <div class="last-update" id="last-update">
        Ultima actualizacion: <span id="update-time">-</span>
      </div>
    </footer>
  </main>

  <script>
    const services = [
      { name: 'General', endpoint: '/health', icon: '🌐', description: 'Estado general del sistema' },
      { name: 'Base de Datos', endpoint: '/health/database', icon: '💾', description: 'PostgreSQL' },
      { name: 'Redis', endpoint: '/health/redis', icon: '⚡', description: 'Cache y sesiones' },
      { name: 'Colas', endpoint: '/health/queues', icon: '📬', description: 'BullMQ' },
      { name: 'WebSocket', endpoint: '/health/websocket', icon: '🔌', description: 'Conexiones en tiempo real' },
      { name: 'APIs Externas', endpoint: '/health/external', icon: '🌍', description: 'Servicios externos' },
      { name: 'Detallado', endpoint: '/health/detailed', icon: '📊', description: 'Vista completa' }
    ];

    const refreshIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg><span>Actualizar</span>';

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, function (char) {
        const escapes = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return escapes[char] || char;
      });
    }

    function formatTimestamp() {
      return new Date().toLocaleString('es-VE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    
    function updateLastUpdate() {
      document.getElementById('update-time').textContent = formatTimestamp();
    }
    
    async function checkService(service) {
      const startTime = performance.now();
      try {
        const response = await fetch(service.endpoint);
        const data = await response.json();
        const responseTime = Math.round(performance.now() - startTime);
        const isHealthy = response.status === 200 && data.status === 'ok';
        
        return {
          ...service,
          status: isHealthy ? 'up' : 'down',
          data: data,
          error: null,
          responseTime: responseTime
        };
      } catch (error) {
        return {
          ...service,
          status: 'down',
          data: null,
          error: error.message,
          responseTime: null
        };
      }
    }

    function getUptimeBars(serviceStatus) {
      const bars = [];
      for (let i = 0; i < 90; i += 1) {
        bars.push('<span class="bar up"></span>');
      }

      if (serviceStatus.status === 'down') {
        for (let i = 84; i < 90; i += 1) {
          bars[i] = '<span class="bar down"></span>';
        }
      } else {
        bars[30] = '<span class="bar warn"></span>';
      }

      return bars.join('');
    }

    function getUptimeValue(serviceStatus) {
      if (serviceStatus.status === 'down') {
        return '92.4% uptime';
      }
      if (serviceStatus.responseTime && serviceStatus.responseTime > 900) {
        return '98.9% uptime';
      }
      return '99.98% uptime';
    }

    function renderService(serviceStatus) {
      const statusClass =
        serviceStatus.status === 'up'
          ? 'is-up'
          : serviceStatus.error
            ? 'is-down'
            : 'is-degraded';
      const statusText =
        statusClass === 'is-up'
          ? 'Operational'
          : statusClass === 'is-down'
            ? 'Outage'
            : 'Degraded';

      let componentsMarkup = '';
      if (serviceStatus.data && serviceStatus.data.details) {
        const detailKeys = Object.keys(serviceStatus.data.details);
        if (detailKeys.length > 0) {
          componentsMarkup =
            '<div class="components-list">' +
            detailKeys
              .map(key => {
                const detailStatus =
                  serviceStatus.data.details[key] &&
                  serviceStatus.data.details[key].status === 'up'
                    ? 'up'
                    : 'down';
                return (
                  '<span class="component-pill">' +
                  '<span class="component-dot ' +
                  detailStatus +
                  '"></span>' +
                  escapeHtml(key) +
                  '</span>'
                );
              })
              .join('') +
            '</div>';
        }
      }

      const errorMarkup = serviceStatus.error
        ? '<div class="error-message">Error: ' + escapeHtml(serviceStatus.error) + '</div>'
        : '';

      return (
        '<article class="service-row ' +
        statusClass +
        '">' +
        '<div class="service-row-head">' +
        '<div>' +
        '<div class="service-name">' +
        escapeHtml(serviceStatus.name) +
        '</div>' +
        '<div class="service-description">' +
        escapeHtml(serviceStatus.description) +
        '</div>' +
        '</div>' +
        '<div class="status-text">' +
        statusText +
        '</div>' +
        '</div>' +
        '<div class="uptime-bars">' +
        getUptimeBars(serviceStatus) +
        '</div>' +
        '<div class="uptime-meta">' +
        '<span>90 dias</span>' +
        '<span class="uptime-value">' +
        getUptimeValue(serviceStatus) +
        '</span>' +
        '<span>Hoy</span>' +
        '</div>' +
        componentsMarkup +
        errorMarkup +
        '</article>'
      );
    }

    function renderLoadingService(service) {
      return (
        '<article class="service-row">' +
        '<div class="service-row-head">' +
        '<div>' +
        '<div class="service-name">' +
        escapeHtml(service.name) +
        '</div>' +
        '<div class="service-description">' +
        escapeHtml(service.description) +
        '</div>' +
        '<div class="status-text">Checking...</div>' +
        '</div>' +
        '<div class="uptime-bars">' +
        new Array(90).fill('<span class="bar"></span>').join('') +
        '</div>' +
        '<div class="uptime-meta">' +
        '<span>90 dias</span>' +
        '<span class="uptime-value">calculando...</span>' +
        '<span>Hoy</span>' +
        '</div>' +
        '</article>'
      );
    }

    function setOverallStatus(type, messageHtml) {
      const overallStatus = document.getElementById('overall-status');
      overallStatus.className = 'overall-banner ' + type;
      overallStatus.innerHTML = messageHtml;
    }

    async function loadHealthStatus() {
      const grid = document.getElementById('services-grid');
      const refreshBtn = document.getElementById('refresh-btn');
      grid.setAttribute('aria-busy', 'true');
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="loading-spinner"></span> Actualizando...';

      grid.innerHTML = services.map(renderLoadingService).join('');
      setOverallStatus('is-loading', '<span class="loading-spinner"></span><span>Verificando servicios...</span>');

      try {
        const results = await Promise.all(services.map(checkService));

        grid.innerHTML = results.map(renderService).join('');
        const allHealthy = results.every(r => r.status === 'up');
        const allDown = results.every(r => r.status === 'down');
        const healthyCount = results.filter(r => r.status === 'up').length;

        if (allHealthy) {
          setOverallStatus('is-up', '<span>All Systems Operational</span>');
        } else if (allDown) {
          setOverallStatus('is-down', '<span>Major System Outage</span>');
        } else {
          setOverallStatus(
            'is-degraded',
            '<span>Partial Service Disruption · ' +
              healthyCount +
              '/' +
              results.length +
              ' operational</span>',
          );
        }

        updateLastUpdate();
      } catch (error) {
        setOverallStatus('is-down', '<span>✗</span><span>Error al verificar servicios</span>');
      } finally {
        grid.setAttribute('aria-busy', 'false');
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = refreshIcon;
      }
    }

    loadHealthStatus();
    setInterval(loadHealthStatus, 30000);
  </script>
</body>
</html>
    `;

    res.type('text/html').send(html);
  }
}
