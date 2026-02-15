import { api } from '@/lib/api';

// Duplicating the interface from the backend for type safety
export interface FederationHealthReport {
  timestamp: string;
  storeId: string;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  metrics: {
    eventLagCount: number;
    projectionGapCount: number;
    stockDivergenceCount: number;
    negativeStockCount: number;
    queueDepth: number;
    failedJobs: number;
    remoteReachable: boolean;
    remoteLatencyMs: number | null;
    fiscalDuplicates: number;
    conflictRate: number;
    outboxBacklog: number;
    outboxDead: number;
  };
  details?: {
    projectionGaps?: {
      sales: number;
      debts: number;
    };
    conflicts?: {
      last1h: number;
    };
  };
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  targetUptime: number;
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    lastChecked?: string;
    error?: string;
  }>;
  timestamp: string;
}

export interface UptimeStats {
  uptime: number;
  targetUptime: number;
  totalUptimeSeconds: number;
  totalDowntimeSeconds: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  period: string;
  periodStart: string;
  periodEnd: string;
}

export interface Alert {
  id: string;
  service_name: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  status: 'active' | 'resolved' | 'acknowledged';
  resolved_at?: string | null;
  created_at: string;
}

export interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastChecked?: string;
}

export const observabilityService = {
  async getAllFederationHealthReports(): Promise<FederationHealthReport[]> {
    const response = await api.get<FederationHealthReport[]>('/observability/federation-health');
    return response.data;
  },

  async getFederationHealthReport(storeId: string): Promise<FederationHealthReport> {
    const response = await api.get<FederationHealthReport>(`/observability/federation-health/${storeId}`);
    return response.data;
  },

  async getStatus(): Promise<HealthStatus> {
    const response = await api.get<HealthStatus>('/observability/status');
    return response.data;
  },

  async getServices(): Promise<{ services: ServiceStatus[] }> {
    const response = await api.get<{ services: ServiceStatus[] }>('/observability/services');
    return response.data;
  },

  async getUptime(service?: string, days?: number): Promise<UptimeStats> {
    const params: any = {};
    if (service) params.service = service;
    if (days) params.days = days;

    const response = await api.get<UptimeStats>('/observability/uptime', { params });
    return response.data;
  },

  async getUptimeHistory(service?: string, hours?: number) {
    const params: any = {};
    if (service) params.service = service;
    if (hours) params.hours = hours;

    const response = await api.get('/observability/uptime/history', { params });
    return response.data;
  },

  async getAlerts(params?: {
    status?: string;
    severity?: string;
    service?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: Alert[]; total: number }> {
    const response = await api.get<{ alerts: Alert[]; total: number }>('/observability/alerts', {
      params,
    });
    return response.data;
  },

  async resolveAlert(alertId: string): Promise<Alert> {
    const response = await api.patch<Alert>(`/observability/alerts/${alertId}/resolve`);
    return response.data;
  },

  async acknowledgeAlert(alertId: string): Promise<Alert> {
    const response = await api.patch<Alert>(`/observability/alerts/${alertId}/acknowledge`);
    return response.data;
  },
};
