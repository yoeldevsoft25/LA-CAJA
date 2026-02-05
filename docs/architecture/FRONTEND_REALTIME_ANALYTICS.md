# 📊 Frontend: Analytics en Tiempo Real - Guía de Implementación

## 📋 Índice
1. [Instalación y Configuración](#instalación-y-configuración)
2. [Interfaces TypeScript](#interfaces-typescript)
3. [Servicio WebSocket](#servicio-websocket)
4. [Servicio API REST](#servicio-api-rest)
5. [React Hooks](#react-hooks)
6. [Componentes UI](#componentes-ui)
7. [Integración con Servicios Existentes](#integración-con-servicios-existentes)
8. [Eventos y Actualizaciones](#eventos-y-actualizaciones)
9. [Manejo de Estados](#manejo-de-estados)
10. [Testing](#testing)

---

## 1. Instalación y Configuración

### Dependencias necesarias

```bash
npm install socket.io-client
npm install @tanstack/react-query  # Si no está instalado
npm install recharts  # Para gráficos
npm install date-fns  # Para manejo de fechas
npm install react-hot-toast  # Para notificaciones
```

### Variables de entorno

Agregar a `.env`:
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## 2. Interfaces TypeScript

Crear `apps/pwa/src/types/realtime-analytics.types.ts`:

```typescript
// Tipos de métricas
export type MetricType = 
  | 'sales' 
  | 'inventory' 
  | 'revenue' 
  | 'profit' 
  | 'customers' 
  | 'products' 
  | 'debt' 
  | 'purchases';

export type PeriodType = 'current' | 'hour' | 'day' | 'week' | 'month';

// Métrica en tiempo real
export interface RealTimeMetric {
  id: string;
  store_id: string;
  metric_type: MetricType;
  metric_name: string;
  metric_value: number;
  previous_value: number | null;
  change_percentage: number | null;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

// Tipos de alerta
export type AlertType = 
  | 'stock_low'
  | 'sale_anomaly'
  | 'revenue_drop'
  | 'revenue_spike'
  | 'inventory_high'
  | 'debt_overdue'
  | 'product_expiring'
  | 'custom';

export type ComparisonOperator = 
  | 'less_than' 
  | 'greater_than' 
  | 'equals' 
  | 'not_equals';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

// Umbral de alerta
export interface AlertThreshold {
  id: string;
  store_id: string;
  alert_type: AlertType;
  metric_name: string;
  threshold_value: number;
  comparison_operator: ComparisonOperator;
  severity: AlertSeverity;
  is_active: boolean;
  notification_channels: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Alerta en tiempo real
export interface RealTimeAlert {
  id: string;
  store_id: string;
  threshold_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric_name: string;
  current_value: number;
  threshold_value: number;
  entity_type: 'sale' | 'product' | 'inventory' | 'customer' | 'debt' | 'purchase' | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  read_by: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

// Heatmap de ventas
export interface SalesHeatmap {
  id: string;
  store_id: string;
  date: string;
  hour: number; // 0-23
  day_of_week: number; // 0-6
  sales_count: number;
  total_amount_bs: number;
  total_amount_usd: number;
  avg_ticket_bs: number;
  avg_ticket_usd: number;
  created_at: string;
  updated_at: string;
}

// Métrica comparativa
export type ComparativeMetricType = 'sales' | 'revenue' | 'profit' | 'customers' | 'products';
export type Trend = 'increasing' | 'decreasing' | 'stable';

export interface ComparativeMetric {
  id: string;
  store_id: string;
  metric_type: ComparativeMetricType;
  current_period_start: string;
  current_period_end: string;
  previous_period_start: string;
  previous_period_end: string;
  current_value: number;
  previous_value: number;
  change_amount: number;
  change_percentage: number;
  trend: Trend;
  metadata: Record<string, any> | null;
  calculated_at: string;
}

// DTOs para requests
export interface GetMetricsParams {
  metric_type?: MetricType;
  metric_name?: string;
  period_type?: PeriodType;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface CreateThresholdParams {
  alert_type: AlertType;
  metric_name: string;
  threshold_value: number;
  comparison_operator?: ComparisonOperator;
  severity?: AlertSeverity;
  is_active?: boolean;
  notification_channels?: string[];
}

export interface GetAlertsParams {
  alert_type?: AlertType;
  severity?: AlertSeverity;
  is_read?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface GetHeatmapParams {
  start_date: string;
  end_date: string;
  hour?: number;
}

export interface GetComparativeParams {
  metric_type: ComparativeMetricType;
  period: 'day' | 'week' | 'month' | 'year';
  reference_date?: string;
}

// Eventos WebSocket
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: number;
}
```

---

## 3. Servicio WebSocket

Crear `apps/pwa/src/services/realtime-analytics.service.ts`:

### Funcionalidades principales:

1. **Conexión autenticada**
   - Conectar con token JWT
   - Manejar reconexión automática
   - Detectar estado de conexión

2. **Suscripciones**
   - `subscribe:metrics` - Suscribirse a métricas específicas o todas
   - `subscribe:alerts` - Suscribirse a alertas

3. **Solicitudes**
   - `get:metrics` - Obtener métricas actuales
   - `get:alerts` - Obtener alertas actuales

4. **Listeners de eventos**
   - `connected` - Confirmación de conexión
   - `subscribed` - Confirmación de suscripción
   - `metric:update` - Nueva actualización de métrica
   - `alert:new` - Nueva alerta generada
   - `heatmap:update` - Actualización de heatmap
   - `error` - Errores

### Estructura sugerida:

```typescript
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './auth.service';

class RealTimeAnalyticsService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  
  connect(storeId: string): void {
    const token = getAuthToken();
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
    
    this.socket = io(`${wsUrl}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToMetrics(metricTypes?: string[]): void {
    this.socket?.emit('subscribe:metrics', { metric_types: metricTypes });
  }

  subscribeToAlerts(): void {
    this.socket?.emit('subscribe:alerts');
  }

  getMetrics(params: { metric_type?: string; limit?: number }): void {
    this.socket?.emit('get:metrics', params);
  }

  getAlerts(params: { is_read?: boolean; limit?: number }): void {
    this.socket?.emit('get:alerts', params);
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
    this.socket?.on(event, callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private setupEventListeners(): void {
    // Implementar listeners base
  }
}

export const realtimeAnalyticsService = new RealTimeAnalyticsService();
```

---

## 4. Servicio API REST

Crear `apps/pwa/src/api/realtime-analytics.api.ts`:

```typescript
import { apiClient } from './api-client';
import type {
  RealTimeMetric,
  AlertThreshold,
  RealTimeAlert,
  SalesHeatmap,
  ComparativeMetric,
  GetMetricsParams,
  CreateThresholdParams,
  GetAlertsParams,
  GetHeatmapParams,
  GetComparativeParams,
} from '../types/realtime-analytics.types';

export const realtimeAnalyticsApi = {
  // Métricas
  getMetrics: (params: GetMetricsParams): Promise<RealTimeMetric[]> =>
    apiClient.get('/realtime-analytics/metrics', { params }),

  calculateMetrics: (): Promise<{ message: string }> =>
    apiClient.post('/realtime-analytics/metrics/calculate'),

  // Umbrales
  getThresholds: (activeOnly?: boolean): Promise<AlertThreshold[]> =>
    apiClient.get('/realtime-analytics/thresholds', {
      params: { active_only: activeOnly },
    }),

  createThreshold: (data: CreateThresholdParams): Promise<AlertThreshold> =>
    apiClient.post('/realtime-analytics/thresholds', data),

  updateThreshold: (
    id: string,
    data: Partial<CreateThresholdParams>
  ): Promise<AlertThreshold> =>
    apiClient.put(`/realtime-analytics/thresholds/${id}`, data),

  deleteThreshold: (id: string): Promise<void> =>
    apiClient.delete(`/realtime-analytics/thresholds/${id}`),

  checkThresholds: (): Promise<{ alerts: RealTimeAlert[]; count: number }> =>
    apiClient.post('/realtime-analytics/thresholds/check'),

  // Alertas
  getAlerts: (params: GetAlertsParams): Promise<RealTimeAlert[]> =>
    apiClient.get('/realtime-analytics/alerts', { params }),

  markAlertRead: (id: string): Promise<RealTimeAlert> =>
    apiClient.post(`/realtime-analytics/alerts/${id}/read`),

  // Heatmap
  getSalesHeatmap: (params: GetHeatmapParams): Promise<SalesHeatmap[]> =>
    apiClient.get('/realtime-analytics/heatmap', { params }),

  // Comparativas
  calculateComparative: (
    params: GetComparativeParams
  ): Promise<ComparativeMetric> =>
    apiClient.post('/realtime-analytics/comparative', params),

  getComparativeMetrics: (
    metricType?: string,
    limit?: number
  ): Promise<ComparativeMetric[]> =>
    apiClient.get('/realtime-analytics/comparative', {
      params: { metric_type: metricType, limit },
    }),
};
```

---

## 5. React Hooks

### Hook: useRealtimeMetrics

```typescript
// apps/pwa/src/hooks/useRealtimeMetrics.ts
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { realtimeAnalyticsService } from '../services/realtime-analytics.service';
import { realtimeAnalyticsApi } from '../api/realtime-analytics.api';
import type { RealTimeMetric, MetricType } from '../types/realtime-analytics.types';

export function useRealtimeMetrics(metricTypes?: MetricType[]) {
  const [metrics, setMetrics] = useState<RealTimeMetric[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Query inicial
  const { data: initialMetrics, isLoading } = useQuery({
    queryKey: ['realtime-metrics', metricTypes],
    queryFn: () =>
      realtimeAnalyticsApi.getMetrics({
        metric_type: metricTypes?.[0],
        limit: 100,
      }),
  });

  useEffect(() => {
    if (initialMetrics) {
      setMetrics(initialMetrics);
    }
  }, [initialMetrics]);

  // WebSocket connection
  useEffect(() => {
    realtimeAnalyticsService.connect('current-store-id'); // Obtener del contexto
    setIsConnected(realtimeAnalyticsService.isConnected());

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleMetricUpdate = (event: { metric: RealTimeMetric }) => {
      setMetrics((prev) => {
        const index = prev.findIndex((m) => m.id === event.metric.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = event.metric;
          return updated;
        }
        return [event.metric, ...prev].slice(0, 100);
      });
    };

    realtimeAnalyticsService.on('connected', handleConnect);
    realtimeAnalyticsService.on('disconnect', handleDisconnect);
    realtimeAnalyticsService.on('metric:update', handleMetricUpdate);

    // Suscribirse
    realtimeAnalyticsService.subscribeToMetrics(
      metricTypes as string[] | undefined
    );

    return () => {
      realtimeAnalyticsService.off('connected', handleConnect);
      realtimeAnalyticsService.off('disconnect', handleDisconnect);
      realtimeAnalyticsService.off('metric:update', handleMetricUpdate);
    };
  }, [metricTypes]);

  return {
    metrics,
    isLoading,
    isConnected,
    refresh: useCallback(() => {
      realtimeAnalyticsService.getMetrics({
        metric_type: metricTypes?.[0],
        limit: 100,
      });
    }, [metricTypes]),
  };
}
```

### Hook: useRealtimeAlerts

```typescript
// apps/pwa/src/hooks/useRealtimeAlerts.ts
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { realtimeAnalyticsService } from '../services/realtime-analytics.service';
import { realtimeAnalyticsApi } from '../api/realtime-analytics.api';
import type { RealTimeAlert } from '../types/realtime-analytics.types';
import toast from 'react-hot-toast';

export function useRealtimeAlerts() {
  const [alerts, setAlerts] = useState<RealTimeAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { data: initialAlerts } = useQuery({
    queryKey: ['realtime-alerts'],
    queryFn: () => realtimeAnalyticsApi.getAlerts({ is_read: false, limit: 50 }),
  });

  useEffect(() => {
    if (initialAlerts) {
      setAlerts(initialAlerts);
      setUnreadCount(initialAlerts.filter((a) => !a.is_read).length);
    }
  }, [initialAlerts]);

  useEffect(() => {
    realtimeAnalyticsService.subscribeToAlerts();

    const handleNewAlert = (event: { alert: RealTimeAlert }) => {
      setAlerts((prev) => [event.alert, ...prev]);
      setUnreadCount((prev) => prev + 1);
      
      // Mostrar notificación
      toast.error(event.alert.title, {
        description: event.alert.message,
        duration: 5000,
      });
    };

    realtimeAnalyticsService.on('alert:new', handleNewAlert);

    return () => {
      realtimeAnalyticsService.off('alert:new', handleNewAlert);
    };
  }, []);

  const markAsReadMutation = useMutation({
    mutationFn: (alertId: string) =>
      realtimeAnalyticsApi.markAlertRead(alertId),
    onSuccess: (updatedAlert) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
  });

  return {
    alerts,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    isLoading: markAsReadMutation.isPending,
  };
}
```

### Hook: useSalesHeatmap

```typescript
// apps/pwa/src/hooks/useSalesHeatmap.ts
import { useQuery } from '@tanstack/react-query';
import { realtimeAnalyticsApi } from '../api/realtime-analytics.api';
import type { GetHeatmapParams, SalesHeatmap } from '../types/realtime-analytics.types';
import { format, subDays } from 'date-fns';

export function useSalesHeatmap(days: number = 7) {
  const endDate = new Date();
  const startDate = subDays(endDate, days);

  return useQuery({
    queryKey: ['sales-heatmap', startDate, endDate],
    queryFn: () =>
      realtimeAnalyticsApi.getSalesHeatmap({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      }),
    select: (data: SalesHeatmap[]) => {
      // Transformar datos para visualización
      const heatmapData: Record<string, Record<number, SalesHeatmap>> = {};
      
      data.forEach((item) => {
        const dateKey = format(new Date(item.date), 'yyyy-MM-dd');
        if (!heatmapData[dateKey]) {
          heatmapData[dateKey] = {};
        }
        heatmapData[dateKey][item.hour] = item;
      });

      return heatmapData;
    },
  });
}
```

### Hook: useComparativeMetrics

```typescript
// apps/pwa/src/hooks/useComparativeMetrics.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { realtimeAnalyticsApi } from '../api/realtime-analytics.api';
import type {
  GetComparativeParams,
  ComparativeMetric,
  ComparativeMetricType,
} from '../types/realtime-analytics.types';

export function useComparativeMetrics(
  metricType: ComparativeMetricType,
  period: 'day' | 'week' | 'month' | 'year'
) {
  const calculateMutation = useMutation({
    mutationFn: (params: GetComparativeParams) =>
      realtimeAnalyticsApi.calculateComparative(params),
  });

  const { data: metrics } = useQuery({
    queryKey: ['comparative-metrics', metricType],
    queryFn: () => realtimeAnalyticsApi.getComparativeMetrics(metricType, 10),
    enabled: !calculateMutation.isPending,
  });

  const calculate = (referenceDate?: string) => {
    calculateMutation.mutate({
      metric_type: metricType,
      period,
      reference_date: referenceDate,
    });
  };

  return {
    metrics,
    latestMetric: metrics?.[0],
    calculate,
    isLoading: calculateMutation.isPending,
  };
}
```

---

## 6. Componentes UI

### Componente: RealtimeMetricsCard

```typescript
// apps/pwa/src/components/realtime/RealtimeMetricsCard.tsx
import { useRealtimeMetrics } from '../../hooks/useRealtimeMetrics';
import { MetricType } from '../../types/realtime-analytics.types';

interface Props {
  metricType: MetricType;
  title: string;
  formatValue?: (value: number) => string;
}

export function RealtimeMetricsCard({ metricType, title, formatValue }: Props) {
  const { metrics, isConnected } = useRealtimeMetrics([metricType]);
  
  const metric = metrics.find((m) => m.metric_type === metricType);

  return (
    <div className="metric-card">
      <div className="metric-header">
        <h3>{title}</h3>
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '●' : '○'}
        </span>
      </div>
      <div className="metric-value">
        {formatValue
          ? formatValue(metric?.metric_value ?? 0)
          : metric?.metric_value.toLocaleString()}
      </div>
      {metric?.change_percentage !== null && (
        <div className={`metric-change ${metric.change_percentage >= 0 ? 'positive' : 'negative'}`}>
          {metric.change_percentage >= 0 ? '↑' : '↓'} {Math.abs(metric.change_percentage).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
```

### Componente: AlertsPanel

```typescript
// apps/pwa/src/components/realtime/AlertsPanel.tsx
import { useRealtimeAlerts } from '../../hooks/useRealtimeAlerts';
import { AlertSeverity } from '../../types/realtime-analytics.types';

export function AlertsPanel() {
  const { alerts, unreadCount, markAsRead } = useRealtimeAlerts();

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'blue';
    }
  };

  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <h2>Alertas</h2>
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </div>
      <div className="alerts-list">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`alert-item ${alert.is_read ? 'read' : 'unread'}`}
            onClick={() => !alert.is_read && markAsRead(alert.id)}
          >
            <div className="alert-severity" style={{ backgroundColor: getSeverityColor(alert.severity) }} />
            <div className="alert-content">
              <h4>{alert.title}</h4>
              <p>{alert.message}</p>
              <span className="alert-time">
                {new Date(alert.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Componente: SalesHeatmapChart

```typescript
// apps/pwa/src/components/realtime/SalesHeatmapChart.tsx
import { useSalesHeatmap } from '../../hooks/useSalesHeatmap';
import { format, eachDayOfInterval, subDays } from 'date-fns';

export function SalesHeatmapChart({ days = 7 }: { days?: number }) {
  const { data: heatmapData, isLoading } = useSalesHeatmap(days);

  if (isLoading) return <div>Cargando...</div>;
  if (!heatmapData) return null;

  const dates = eachDayOfInterval({
    start: subDays(new Date(), days),
    end: new Date(),
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getIntensity = (salesCount: number, maxCount: number) => {
    if (salesCount === 0) return 0;
    return Math.min(100, (salesCount / maxCount) * 100);
  };

  const maxCount = Math.max(
    ...Object.values(heatmapData).flatMap((day) =>
      Object.values(day).map((item) => item.sales_count)
    )
  );

  return (
    <div className="heatmap-container">
      <div className="heatmap-grid">
        <div className="heatmap-header">
          <div className="hour-label"></div>
          {dates.map((date) => (
            <div key={date.toISOString()} className="date-label">
              {format(date, 'dd/MM')}
            </div>
          ))}
        </div>
        {hours.map((hour) => (
          <div key={hour} className="heatmap-row">
            <div className="hour-label">{hour}:00</div>
            {dates.map((date) => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const item = heatmapData[dateKey]?.[hour];
              const intensity = item
                ? getIntensity(item.sales_count, maxCount)
                : 0;

              return (
                <div
                  key={`${dateKey}-${hour}`}
                  className="heatmap-cell"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${intensity / 100})`,
                  }}
                  title={
                    item
                      ? `${item.sales_count} ventas - ${item.total_amount_bs.toFixed(2)} BS`
                      : 'Sin ventas'
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Componente: ComparativeMetricsChart

```typescript
// apps/pwa/src/components/realtime/ComparativeMetricsChart.tsx
import { useComparativeMetrics } from '../../hooks/useComparativeMetrics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ComparativeMetricType } from '../../types/realtime-analytics.types';

interface Props {
  metricType: ComparativeMetricType;
  period: 'day' | 'week' | 'month' | 'year';
}

export function ComparativeMetricsChart({ metricType, period }: Props) {
  const { latestMetric, calculate, isLoading } = useComparativeMetrics(
    metricType,
    period
  );

  if (!latestMetric) {
    return (
      <div>
        <button onClick={() => calculate()}>Calcular Métricas</button>
      </div>
    );
  }

  const chartData = [
    {
      name: 'Período Anterior',
      value: latestMetric.previous_value,
    },
    {
      name: 'Período Actual',
      value: latestMetric.current_value,
    },
  ];

  const trendIcon =
    latestMetric.trend === 'increasing'
      ? '↑'
      : latestMetric.trend === 'decreasing'
      ? '↓'
      : '→';

  return (
    <div className="comparative-chart">
      <div className="chart-header">
        <h3>Comparativa {period}</h3>
        <div className={`trend-indicator ${latestMetric.trend}`}>
          {trendIcon} {latestMetric.change_percentage.toFixed(1)}%
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Componente: ThresholdsManager

```typescript
// apps/pwa/src/components/realtime/ThresholdsManager.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { realtimeAnalyticsApi } from '../../api/realtime-analytics.api';
import type { CreateThresholdParams, AlertThreshold } from '../../types/realtime-analytics.types';

export function ThresholdsManager() {
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: thresholds } = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: () => realtimeAnalyticsApi.getThresholds(true),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateThresholdParams) =>
      realtimeAnalyticsApi.createThreshold(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] });
      setIsCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateThresholdParams> }) =>
      realtimeAnalyticsApi.updateThreshold(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => realtimeAnalyticsApi.deleteThreshold(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] });
    },
  });

  return (
    <div className="thresholds-manager">
      <div className="header">
        <h2>Umbrales de Alertas</h2>
        <button onClick={() => setIsCreating(true)}>Crear Umbral</button>
      </div>

      {isCreating && (
        <ThresholdForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <div className="thresholds-list">
        {thresholds?.map((threshold) => (
          <ThresholdItem
            key={threshold.id}
            threshold={threshold}
            onUpdate={(data) =>
              updateMutation.mutate({ id: threshold.id, data })
            }
            onDelete={() => deleteMutation.mutate(threshold.id)}
            onToggle={() =>
              updateMutation.mutate({
                id: threshold.id,
                data: { is_active: !threshold.is_active },
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 7. Integración con Servicios Existentes

### En SalesService (después de crear venta)

```typescript
// Después de crear una venta exitosamente
import { realtimeAnalyticsService } from '../services/realtime-analytics.service';

// Actualizar heatmap
realtimeAnalyticsService.emit('update:heatmap', {
  store_id: storeId,
  sale_date: new Date(),
});

// Calcular métricas
await realtimeAnalyticsApi.calculateMetrics();
```

### En InventoryService (después de movimiento)

```typescript
// Después de un movimiento de inventario
// Verificar umbrales de stock
await realtimeAnalyticsApi.checkThresholds();
```

---

## 8. Eventos y Actualizaciones

### Eventos WebSocket que se reciben:

1. **`connected`**: Confirmación de conexión
   ```typescript
   { store_id: string, timestamp: number }
   ```

2. **`subscribed`**: Confirmación de suscripción
   ```typescript
   { metric_types: string[] | ['all'], timestamp: number }
   ```

3. **`metric:update`**: Actualización de métrica
   ```typescript
   { metric: RealTimeMetric, timestamp: number }
   ```

4. **`alert:new`**: Nueva alerta
   ```typescript
   { alert: RealTimeAlert, timestamp: number }
   ```

5. **`heatmap:update`**: Actualización de heatmap
   ```typescript
   { heatmap: SalesHeatmap, timestamp: number }
   ```

6. **`error`**: Error de conexión/autenticación
   ```typescript
   { message: string }
   ```

---

## 9. Manejo de Estados

### Estados de conexión:

- **Conectado**: WebSocket activo, recibiendo actualizaciones
- **Desconectado**: Sin conexión, mostrar indicador
- **Reconectando**: Intentando reconectar automáticamente
- **Error**: Error de autenticación o conexión

### Cache y sincronización:

- Usar React Query para cache de datos iniciales
- Actualizar cache cuando lleguen eventos WebSocket
- Invalidar queries cuando sea necesario refrescar

---

## 10. Testing

### Mock del servicio WebSocket:

```typescript
// __mocks__/realtime-analytics.service.ts
export const realtimeAnalyticsService = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribeToMetrics: jest.fn(),
  subscribeToAlerts: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  isConnected: jest.fn(() => true),
};
```

### Tests de hooks:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeMetrics } from '../hooks/useRealtimeMetrics';

test('useRealtimeMetrics should fetch and update metrics', async () => {
  const { result } = renderHook(() => useRealtimeMetrics(['sales']));
  
  await waitFor(() => {
    expect(result.current.metrics).toBeDefined();
  });
});
```

---

## 📝 Notas Finales

1. **Performance**: 
   - Debounce actualizaciones frecuentes
   - Limitar cantidad de métricas en memoria
   - Usar virtualización para listas largas

2. **Offline**:
   - Cachear métricas en localStorage
   - Sincronizar al reconectar
   - Mostrar indicador de datos en cache

3. **UX**:
   - Indicadores visuales de estado de conexión
   - Animaciones suaves para actualizaciones
   - Notificaciones no intrusivas para alertas

4. **Accesibilidad**:
   - ARIA labels en todos los componentes
   - Navegación por teclado
   - Contraste adecuado en indicadores de color

---

**Última actualización**: Enero 2025

