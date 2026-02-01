import { Controller, Get, Res, Header } from '@nestjs/common';
import { FastifyReply } from 'fastify';
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

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
    private bullmq: BullMQHealthIndicator,
    private externalApis: ExternalApisHealthIndicator,
    private websocket: WebSocketHealthIndicator,
  ) { }

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check general del sistema' })
  @ApiResponse({ status: 200, description: 'Sistema saludable' })
  @ApiResponse({ status: 503, description: 'Sistema no saludable' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024), // 500MB
    ]);
  }

  @Get('database')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de la base de datos PostgreSQL' })
  @ApiResponse({ status: 200, description: 'Base de datos saludable' })
  @ApiResponse({ status: 503, description: 'Base de datos no disponible' })
  checkDatabase() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de Redis' })
  @ApiResponse({ status: 200, description: 'Redis saludable' })
  @ApiResponse({ status: 503, description: 'Redis no disponible' })
  checkRedis() {
    return this.health.check([
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('queues')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de colas BullMQ' })
  @ApiResponse({ status: 200, description: 'Colas saludables' })
  @ApiResponse({ status: 503, description: 'Colas con problemas' })
  checkQueues() {
    return this.health.check([
      () => this.bullmq.isHealthy('bullmq'),
    ]);
  }

  @Get('external')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de APIs externas' })
  @ApiResponse({ status: 200, description: 'APIs externas saludables' })
  @ApiResponse({ status: 503, description: 'Algunas APIs externas no disponibles' })
  checkExternal() {
    return this.health.check([
      () => this.externalApis.isHealthy('external_apis'),
    ]);
  }

  @Get('websocket')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check de WebSocket' })
  @ApiResponse({ status: 200, description: 'WebSocket operacional' })
  checkWebSocket() {
    return this.health.check([
      () => this.websocket.isHealthy('websocket'),
    ]);
  }

  @Get('detailed')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check detallado de todos los servicios' })
  @ApiResponse({ status: 200, description: 'Todos los servicios saludables' })
  @ApiResponse({ status: 503, description: 'Algunos servicios no saludables' })
  checkDetailed() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.bullmq.isHealthy('bullmq'),
      () => this.websocket.isHealthy('websocket'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9, // 90% de uso máximo
        }),
    ]);
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    :root {
      --primary: hsl(221, 83%, 53%);
      --primary-foreground: hsl(0, 0%, 100%);
      --secondary: hsl(210, 40%, 96%);
      --muted: hsl(210, 40%, 96%);
      --muted-foreground: hsl(215, 16%, 47%);
      --accent: hsl(210, 40%, 96%);
      --destructive: hsl(0, 84%, 60%);
      --destructive-foreground: hsl(0, 0%, 100%);
      --success: hsl(142, 76%, 36%);
      --warning: hsl(38, 92%, 50%);
      --border: hsl(214, 32%, 91%);
      --input: hsl(214, 32%, 91%);
      --ring: hsl(221, 83%, 53%);
      --background: hsl(0, 0%, 100%);
      --foreground: hsl(222, 47%, 11%);
      --card: hsl(0, 0%, 100%);
      --card-foreground: hsl(222, 47%, 11%);
      --radius: 0.5rem;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 45%) 50%, hsl(221, 83%, 40%) 100%);
      background-attachment: fixed;
      min-height: 100vh;
      padding: 2rem 1rem;
      color: var(--foreground);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.08) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }
    
    .header {
      background: var(--card);
      border-radius: calc(var(--radius) + 4px);
      padding: 3.5rem 2.5rem;
      margin-bottom: 2.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06);
      border: 1px solid var(--border);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--primary) 0%, hsl(221, 83%, 45%) 100%);
    }
    
    .header-content {
      position: relative;
      z-index: 1;
    }
    
    .header h1 {
      color: var(--foreground);
      font-size: 2.75rem;
      font-weight: 800;
      margin-bottom: 0.75rem;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    
    .header p {
      color: var(--muted-foreground);
      font-size: 1.125rem;
      font-weight: 400;
      margin-bottom: 1rem;
    }
    
    .header-subtitle {
      color: var(--muted-foreground);
      font-size: 0.8125rem;
      font-weight: 500;
      margin-top: 0.5rem;
      display: inline-block;
      padding: 0.375rem 0.875rem;
      background: var(--muted);
      border-radius: 9999px;
      letter-spacing: 0.01em;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
      margin-top: 1.5rem;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    
    .status-badge.healthy {
      background: var(--success);
      color: white;
      border-color: hsl(142, 76%, 30%);
    }
    
    .status-badge.unhealthy {
      background: var(--destructive);
      color: white;
      border-color: hsl(0, 84%, 55%);
    }
    
    .status-badge.loading {
      background: var(--warning);
      color: white;
      border-color: hsl(38, 92%, 45%);
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .card {
      background: var(--card);
      border-radius: calc(var(--radius) + 2px);
      padding: 1.75rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid var(--border);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
    }
    
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--primary) 0%, hsl(221, 83%, 45%) 100%);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.12), 0 8px 16px -6px rgba(0, 0, 0, 0.08);
      border-color: var(--primary);
    }
    
    .card:hover::before {
      opacity: 1;
    }
    
    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1rem;
      gap: 1rem;
    }
    
    .card-title-wrapper {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }
    
    .card-icon {
      width: 44px;
      height: 44px;
      border-radius: 0.625rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.375rem;
      background: linear-gradient(135deg, var(--muted) 0%, hsl(210, 40%, 92%) 100%);
      flex-shrink: 0;
      border: 1px solid var(--border);
      transition: all 0.2s ease;
    }
    
    .card:hover .card-icon {
      background: linear-gradient(135deg, var(--primary) 0%, hsl(221, 83%, 45%) 100%);
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }
    
    .card-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--card-foreground);
      letter-spacing: -0.01em;
      line-height: 1.4;
    }
    
    .card-description {
      font-size: 0.75rem;
      color: var(--muted-foreground);
      margin-top: 0.375rem;
      line-height: 1.4;
    }
    
    .status-indicator-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
      position: relative;
    }
    
    .status-indicator.up {
      background: var(--success);
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      animation: pulse-success 2s infinite;
    }
    
    .status-indicator.down {
      background: var(--destructive);
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
      animation: pulse-destructive 2s infinite;
    }
    
    .status-indicator.loading {
      background: var(--warning);
      animation: pulse-warning 2s infinite;
    }
    
    @keyframes pulse-success {
      0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
    }
    
    @keyframes pulse-destructive {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
    }
    
    @keyframes pulse-warning {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
      50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
    }
    
    .status-badge-small {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid transparent;
    }
    
    .status-badge-small.up {
      background: hsl(142, 76%, 95%);
      color: var(--success);
      border-color: hsl(142, 76%, 85%);
    }
    
    .status-badge-small.down {
      background: hsl(0, 84%, 95%);
      color: var(--destructive);
      border-color: hsl(0, 84%, 85%);
    }
    
    .card-content {
      color: var(--muted-foreground);
      font-size: 0.875rem;
      line-height: 1.6;
      flex: 1;
    }
    
    .card-content strong {
      color: var(--card-foreground);
      font-weight: 600;
    }
    
    .components-list {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    
    .component-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0;
      font-size: 0.8125rem;
      transition: all 0.15s ease;
    }
    
    .component-item:hover {
      padding-left: 0.25rem;
    }
    
    .component-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
    }
    
    .component-status.up {
      background: var(--success);
    }
    
    .component-status.down {
      background: var(--destructive);
    }
    
    .error-message {
      color: var(--destructive);
      font-weight: 500;
      margin-top: 1rem;
      font-size: 0.8125rem;
      padding: 0.75rem;
      background: hsl(0, 84%, 97%);
      border-radius: 0.375rem;
      border-left: 3px solid var(--destructive);
    }
    
    .actions {
      text-align: center;
      margin: 2rem 0;
    }
    
    .refresh-btn {
      background: var(--primary);
      color: var(--primary-foreground);
      border: none;
      padding: 0.875rem 2.25rem;
      border-radius: calc(var(--radius) + 2px);
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px 0 rgba(59, 130, 246, 0.2);
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      font-family: inherit;
      letter-spacing: 0.01em;
    }
    
    .refresh-btn:hover {
      background: hsl(221, 83%, 48%);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px -2px rgba(59, 130, 246, 0.3), 0 4px 8px -4px rgba(59, 130, 246, 0.2);
    }
    
    .refresh-btn:active {
      transform: translateY(0);
    }
    
    .refresh-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .last-update {
      text-align: center;
      color: rgba(255, 255, 255, 0.95);
      margin-top: 2rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    
    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(12px);
      border-radius: calc(var(--radius) + 2px);
      padding: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.25);
      text-align: center;
      transition: all 0.2s ease;
    }
    
    .stat-card:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
    }
    
    .stat-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: white;
      margin-bottom: 0.5rem;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      letter-spacing: -0.02em;
    }
    
    .stat-label {
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    @media (max-width: 768px) {
      .header {
        padding: 2rem 1.5rem;
      }
      
      .header h1 {
        font-size: 2rem;
      }
      
      .grid {
        grid-template-columns: 1fr;
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <h1>Health Dashboard</h1>
        <p>Monitoreo en tiempo real del sistema Velox POS</p>
        <div class="header-subtitle">Sistema POS Offline-First para Venezuela</div>
        <div id="overall-status" class="status-badge loading">
          <span class="loading-spinner"></span>
          <span>Cargando servicios...</span>
        </div>
      </div>
    </div>
    
    <div class="stats-grid" id="stats-grid" style="display: none;">
      <div class="stat-card">
        <div class="stat-value" id="stat-healthy">-</div>
        <div class="stat-label">Operacionales</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-down">-</div>
        <div class="stat-label">No disponibles</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-total">-</div>
        <div class="stat-label">Total servicios</div>
      </div>
    </div>
    
    <div class="grid" id="services-grid">
      <!-- Los servicios se cargarán aquí dinámicamente -->
    </div>
    
    <div class="actions">
      <button class="refresh-btn" onclick="loadHealthStatus()" id="refresh-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        Actualizar
      </button>
    </div>
    
    <div class="last-update" id="last-update">
      Última actualización: <span id="update-time">-</span>
    </div>
  </div>
  
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
    
    function renderService(serviceStatus) {
      const statusClass = serviceStatus.status === 'up' ? 'up' : 'down';
      const statusText = serviceStatus.status === 'up' ? 'Operacional' : 'No disponible';
      
      let content = \`<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
        <strong>Estado:</strong>
        <span class="status-badge-small \${statusClass}">\${statusText}</span>
        \${serviceStatus.responseTime ? \`<span style="color: var(--muted-foreground); font-size: 0.75rem;">(\${serviceStatus.responseTime}ms)</span>\` : ''}
      </div>\`;
      
      if (serviceStatus.data && serviceStatus.data.details) {
        const details = serviceStatus.data.details;
        const detailKeys = Object.keys(details);
        if (detailKeys.length > 0) {
          content += '<div class="components-list"><strong style="display: block; margin-bottom: 0.5rem;">Componentes:</strong>';
          detailKeys.forEach(key => {
            const detail = details[key];
            const detailStatus = detail.status === 'up' ? 'up' : 'down';
            const detailIcon = detail.status === 'up' ? '✓' : '✗';
            content += \`
              <div class="component-item">
                <span class="component-status \${detailStatus}"></span>
                <span>\${key}</span>
              </div>
            \`;
          });
          content += '</div>';
        }
      }
      
      if (serviceStatus.error) {
        content += \`<div class="error-message">Error: \${serviceStatus.error}</div>\`;
      }
      
      return \`
        <div class="card">
          <div class="card-header">
            <div class="card-title-wrapper">
              <div class="card-icon">\${serviceStatus.icon}</div>
              <div>
                <div class="card-title">\${serviceStatus.name}</div>
                <div class="card-description">\${serviceStatus.description}</div>
              </div>
            </div>
            <div class="status-indicator-wrapper">
              <span class="status-indicator \${statusClass}"></span>
            </div>
          </div>
          <div class="card-content">
            \${content}
          </div>
        </div>
      \`;
    }
    
    function updateStats(results) {
      const healthy = results.filter(r => r.status === 'up').length;
      const down = results.filter(r => r.status === 'down').length;
      const total = results.length;
      
      document.getElementById('stat-healthy').textContent = healthy;
      document.getElementById('stat-down').textContent = down;
      document.getElementById('stat-total').textContent = total;
      document.getElementById('stats-grid').style.display = 'grid';
    }
    
    async function loadHealthStatus() {
      const grid = document.getElementById('services-grid');
      const overallStatus = document.getElementById('overall-status');
      const refreshBtn = document.getElementById('refresh-btn');
      
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="loading-spinner"></span> Actualizando...';
      
      // Mostrar estado de carga
      grid.innerHTML = services.map(s => \`
        <div class="card">
          <div class="card-header">
            <div class="card-title-wrapper">
              <div class="card-icon">\${s.icon}</div>
              <div>
                <div class="card-title">\${s.name}</div>
                <div class="card-description">\${s.description}</div>
              </div>
            </div>
            <div class="status-indicator-wrapper">
              <span class="status-indicator loading"></span>
            </div>
          </div>
          <div class="card-content">Verificando estado...</div>
        </div>
      \`).join('');
      
      overallStatus.innerHTML = '<span class="loading-spinner"></span><span>Verificando servicios...</span>';
      overallStatus.className = 'status-badge loading';
      
      try {
        // Verificar todos los servicios
        const results = await Promise.all(services.map(checkService));
        
        // Renderizar resultados
        grid.innerHTML = results.map(renderService).join('');
        
        // Actualizar estadísticas
        updateStats(results);
        
        // Actualizar estado general
        const allHealthy = results.every(r => r.status === 'up');
        const allDown = results.every(r => r.status === 'down');
        const healthyCount = results.filter(r => r.status === 'up').length;
        
        if (allHealthy) {
          overallStatus.innerHTML = '<span>✓</span><span>Todos los servicios operacionales</span>';
          overallStatus.className = 'status-badge healthy';
        } else if (allDown) {
          overallStatus.innerHTML = '<span>✗</span><span>Todos los servicios no disponibles</span>';
          overallStatus.className = 'status-badge unhealthy';
        } else {
          overallStatus.innerHTML = \`<span>⚠</span><span>\${healthyCount}/\${results.length} servicios operacionales</span>\`;
          overallStatus.className = 'status-badge unhealthy';
        }
        
        updateLastUpdate();
      } catch (error) {
        overallStatus.innerHTML = '<span>✗</span><span>Error al verificar servicios</span>';
        overallStatus.className = 'status-badge unhealthy';
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = \`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Actualizar
        \`;
      }
    }
    
    // Cargar estado inicial
    loadHealthStatus();
    
    // Auto-refresh cada 30 segundos
    setInterval(loadHealthStatus, 30000);
  </script>
</body>
</html>
    `;

    res.type('text/html').send(html);
  }
}
