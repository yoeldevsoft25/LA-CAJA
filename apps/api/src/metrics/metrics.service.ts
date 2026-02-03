import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry, register } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  // HTTP Metrics
  public httpRequestsTotal: Counter<string>;
  public httpRequestDuration: Histogram<string>;
  public httpRequestsByStatus: Counter<string>;
  public httpRequestsByEndpoint: Counter<string>;

  // Database Metrics
  public dbQueryDuration: Histogram<string>;
  public dbQueryErrors: Counter<string>;
  public dbConnectionPoolSize: Gauge<string>;

  // Queue Metrics
  public queueJobsTotal: Counter<string>;
  public queueJobsPending: Gauge<string>;
  public queueJobsFailed: Counter<string>;
  public queueProcessingDuration: Histogram<string>;

  // Business Metrics
  public salesTotal: Counter<string>;
  public syncEventsTotal: Counter<string>;
  public syncConflictsTotal: Counter<string>;
  public activeStores: Gauge<string>;

  // System Metrics (ya están en defaultMetrics de Prometheus)
  // process_memory_bytes, process_cpu_seconds_total, uptime_seconds

  onModuleInit() {
    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    this.httpRequestsByStatus = new Counter({
      name: 'http_requests_by_status',
      help: 'HTTP requests by status code',
      labelNames: ['status'],
      registers: [register],
    });

    this.httpRequestsByEndpoint = new Counter({
      name: 'http_requests_by_endpoint',
      help: 'HTTP requests by endpoint',
      labelNames: ['endpoint'],
      registers: [register],
    });

    // Database Metrics
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register],
    });

    this.dbQueryErrors = new Counter({
      name: 'db_query_errors_total',
      help: 'Total number of database query errors',
      labelNames: ['operation', 'table'],
      registers: [register],
    });

    this.dbConnectionPoolSize = new Gauge({
      name: 'db_connection_pool_size',
      help: 'Current database connection pool size',
      labelNames: ['state'], // 'active', 'idle', 'waiting'
      registers: [register],
    });

    // Queue Metrics
    this.queueJobsTotal = new Counter({
      name: 'queue_jobs_total',
      help: 'Total number of queue jobs',
      labelNames: ['queue', 'status'], // 'completed', 'failed', 'active'
      registers: [register],
    });

    this.queueJobsPending = new Gauge({
      name: 'queue_jobs_pending',
      help: 'Number of pending queue jobs',
      labelNames: ['queue'],
      registers: [register],
    });

    this.queueJobsFailed = new Counter({
      name: 'queue_jobs_failed',
      help: 'Total number of failed queue jobs',
      labelNames: ['queue'],
      registers: [register],
    });

    this.queueProcessingDuration = new Histogram({
      name: 'queue_processing_duration_seconds',
      help: 'Duration of queue job processing in seconds',
      labelNames: ['queue'],
      buckets: [1, 5, 10, 30, 60, 300],
      registers: [register],
    });

    // Business Metrics
    this.salesTotal = new Counter({
      name: 'sales_total',
      help: 'Total number of sales',
      labelNames: ['store_id', 'payment_method'],
      registers: [register],
    });

    this.syncEventsTotal = new Counter({
      name: 'sync_events_total',
      help: 'Total number of sync events',
      labelNames: ['store_id', 'event_type'],
      registers: [register],
    });

    this.syncConflictsTotal = new Counter({
      name: 'sync_conflicts_total',
      help: 'Total number of sync conflicts',
      labelNames: ['store_id'],
      registers: [register],
    });

    this.activeStores = new Gauge({
      name: 'active_stores',
      help: 'Number of active stores',
      registers: [register],
    });
  }

  /**
   * Registra una métrica HTTP
   */
  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    duration: number,
  ) {
    this.httpRequestsTotal.inc({ method, route });
    this.httpRequestDuration.observe(
      { method, route, status: status.toString() },
      duration,
    );
    this.httpRequestsByStatus.inc({ status: status.toString() });
    this.httpRequestsByEndpoint.inc({ endpoint: route });
  }

  /**
   * Registra una métrica de base de datos
   */
  recordDbQuery(
    operation: string,
    table: string,
    duration: number,
    error?: Error,
  ) {
    this.dbQueryDuration.observe({ operation, table }, duration);
    if (error) {
      this.dbQueryErrors.inc({ operation, table });
    }
  }

  /**
   * Actualiza el tamaño del pool de conexiones
   */
  updateConnectionPoolSize(active: number, idle: number, waiting: number) {
    this.dbConnectionPoolSize.set({ state: 'active' }, active);
    this.dbConnectionPoolSize.set({ state: 'idle' }, idle);
    this.dbConnectionPoolSize.set({ state: 'waiting' }, waiting);
  }

  /**
   * Registra una métrica de cola
   */
  recordQueueJob(
    queue: string,
    status: 'completed' | 'failed' | 'active',
    duration?: number,
  ) {
    this.queueJobsTotal.inc({ queue, status });
    if (status === 'failed') {
      this.queueJobsFailed.inc({ queue });
    }
    if (duration !== undefined) {
      this.queueProcessingDuration.observe({ queue }, duration);
    }
  }

  /**
   * Actualiza el número de jobs pendientes
   */
  updatePendingJobs(queue: string, count: number) {
    this.queueJobsPending.set({ queue }, count);
  }

  /**
   * Registra una venta
   */
  recordSale(storeId: string, paymentMethod: string) {
    this.salesTotal.inc({ store_id: storeId, payment_method: paymentMethod });
  }

  /**
   * Registra un evento de sincronización
   */
  recordSyncEvent(storeId: string, eventType: string) {
    this.syncEventsTotal.inc({ store_id: storeId, event_type: eventType });
  }

  /**
   * Registra un conflicto de sincronización
   */
  recordSyncConflict(storeId: string) {
    this.syncConflictsTotal.inc({ store_id: storeId });
  }

  /**
   * Actualiza el número de tiendas activas
   */
  updateActiveStores(count: number) {
    this.activeStores.set(count);
  }
}
