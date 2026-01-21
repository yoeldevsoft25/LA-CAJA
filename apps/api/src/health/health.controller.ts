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
  ) {}

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
  <title>LA CAJA - Health Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      text-align: center;
    }
    
    .header h1 {
      color: #667eea;
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .header p {
      color: #666;
      font-size: 1.1em;
    }
    
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 0.9em;
      margin-top: 10px;
    }
    
    .status-badge.healthy {
      background: #10b981;
      color: white;
    }
    
    .status-badge.unhealthy {
      background: #ef4444;
      color: white;
    }
    
    .status-badge.loading {
      background: #f59e0b;
      color: white;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.3);
    }
    
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .card-title {
      font-size: 1.3em;
      font-weight: 600;
      color: #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .status-indicator {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-block;
      animation: pulse 2s infinite;
    }
    
    .status-indicator.up {
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    }
    
    .status-indicator.down {
      background: #ef4444;
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
      animation: pulse-red 2s infinite;
    }
    
    .status-indicator.loading {
      background: #f59e0b;
      animation: pulse-orange 2s infinite;
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    
    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    
    @keyframes pulse-orange {
      0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
      100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
    }
    
    .card-content {
      color: #666;
    }
    
    .card-content strong {
      color: #333;
    }
    
    .error-message {
      color: #ef4444;
      font-weight: 600;
      margin-top: 10px;
    }
    
    .refresh-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1em;
      cursor: pointer;
      transition: background 0.3s ease;
      margin-top: 20px;
    }
    
    .refresh-btn:hover {
      background: #5568d3;
    }
    
    .last-update {
      text-align: center;
      color: white;
      margin-top: 20px;
      font-size: 0.9em;
    }
    
    .loading-spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 Health Dashboard</h1>
      <p>Monitoreo en tiempo real del sistema LA CAJA</p>
      <div id="overall-status" class="status-badge loading">
        <span class="loading-spinner"></span> Cargando...
      </div>
    </div>
    
    <div class="grid" id="services-grid">
      <!-- Los servicios se cargarán aquí dinámicamente -->
    </div>
    
    <div style="text-align: center;">
      <button class="refresh-btn" onclick="loadHealthStatus()">
        🔄 Actualizar
      </button>
    </div>
    
    <div class="last-update" id="last-update">
      Última actualización: <span id="update-time">-</span>
    </div>
  </div>
  
  <script>
    const services = [
      { name: 'General', endpoint: '/health', icon: '🌐', description: 'Estado general del sistema' },
      { name: 'Base de Datos', endpoint: '/health/database', icon: '🗄️', description: 'PostgreSQL' },
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
      try {
        const response = await fetch(service.endpoint);
        const data = await response.json();
        const isHealthy = response.status === 200 && data.status === 'ok';
        
        return {
          ...service,
          status: isHealthy ? 'up' : 'down',
          data: data,
          error: null
        };
      } catch (error) {
        return {
          ...service,
          status: 'down',
          data: null,
          error: error.message
        };
      }
    }
    
    function renderService(serviceStatus) {
      const statusClass = serviceStatus.status === 'up' ? 'up' : 'down';
      const statusText = serviceStatus.status === 'up' ? 'Operacional' : 'No disponible';
      const statusColor = serviceStatus.status === 'up' ? '#10b981' : '#ef4444';
      
      let content = \`<strong>Estado:</strong> \${statusText}\`;
      
      if (serviceStatus.data && serviceStatus.data.details) {
        const details = serviceStatus.data.details;
        const detailKeys = Object.keys(details);
        if (detailKeys.length > 0) {
          content += '<br><br><strong>Componentes:</strong><br>';
          detailKeys.forEach(key => {
            const detail = details[key];
            const detailStatus = detail.status === 'up' ? '✅' : '❌';
            content += \`\${detailStatus} \${key}<br>\`;
          });
        }
      }
      
      if (serviceStatus.error) {
        content += \`<div class="error-message">Error: \${serviceStatus.error}</div>\`;
      }
      
      return \`
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>\${serviceStatus.icon}</span>
              <span>\${serviceStatus.name}</span>
            </div>
            <span class="status-indicator \${statusClass}"></span>
          </div>
          <div class="card-content">
            \${content}
          </div>
        </div>
      \`;
    }
    
    async function loadHealthStatus() {
      const grid = document.getElementById('services-grid');
      const overallStatus = document.getElementById('overall-status');
      
      // Mostrar estado de carga
      grid.innerHTML = services.map(s => \`
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <span>\${s.icon}</span>
              <span>\${s.name}</span>
            </div>
            <span class="status-indicator loading"></span>
          </div>
          <div class="card-content">Cargando...</div>
        </div>
      \`).join('');
      
      overallStatus.innerHTML = '<span class="loading-spinner"></span> Verificando servicios...';
      overallStatus.className = 'status-badge loading';
      
      // Verificar todos los servicios
      const results = await Promise.all(services.map(checkService));
      
      // Renderizar resultados
      grid.innerHTML = results.map(renderService).join('');
      
      // Actualizar estado general
      const allHealthy = results.every(r => r.status === 'up');
      const allDown = results.every(r => r.status === 'down');
      
      if (allHealthy) {
        overallStatus.textContent = '✅ Todos los servicios operacionales';
        overallStatus.className = 'status-badge healthy';
      } else if (allDown) {
        overallStatus.textContent = '❌ Todos los servicios no disponibles';
        overallStatus.className = 'status-badge unhealthy';
      } else {
        const healthyCount = results.filter(r => r.status === 'up').length;
        overallStatus.textContent = \`⚠️ \${healthyCount}/\${results.length} servicios operacionales\`;
        overallStatus.className = 'status-badge unhealthy';
      }
      
      updateLastUpdate();
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
