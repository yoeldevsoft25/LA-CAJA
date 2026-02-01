import { api } from '@/lib/api';

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
  /**
   * Obtiene el estado general del sistema
   */
  async getStatus(): Promise<HealthStatus> {
    const response = await api.get<HealthStatus>('/observability/status');
    return response.data;
  },

  /**
   * Obtiene el estado de todos los servicios
   */
  async getServices(): Promise<{ services: ServiceStatus[] }> {
    const response = await api.get<{ services: ServiceStatus[] }>('/observability/services');
    return response.data;
  },

  /**
   * Obtiene estadísticas de uptime
   */
  async getUptime(service?: string, days?: number): Promise<UptimeStats> {
    const params: any = {};
    if (service) params.service = service;
    if (days) params.days = days;

    const response = await api.get<UptimeStats>('/observability/uptime', { params });
    return response.data;
  },

  /**
   * Obtiene historial de uptime
   */
  async getUptimeHistory(service?: string, hours?: number) {
    const params: any = {};
    if (service) params.service = service;
    if (hours) params.hours = hours;

    const response = await api.get('/observability/uptime/history', { params });
    return response.data;
  },

  /**
   * Obtiene alertas activas
   */
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

  /**
   * Resuelve una alerta
   */
  async resolveAlert(alertId: string): Promise<Alert> {
    const response = await api.patch<Alert>(`/observability/alerts/${alertId}/resolve`);
    return response.data;
  },

  /**
   * Reconoce una alerta
   */
  async acknowledgeAlert(alertId: string): Promise<Alert> {
    const response = await api.patch<Alert>(`/observability/alerts/${alertId}/acknowledge`);
    return response.data;
  },
};
