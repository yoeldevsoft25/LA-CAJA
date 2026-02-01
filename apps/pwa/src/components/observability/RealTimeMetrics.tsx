import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getApiBaseUrl } from '@/lib/api';

export function RealTimeMetrics() {
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    // Obtener URL del API
    const apiUrl = getApiBaseUrl();
    const token = localStorage.getItem('auth_token');

    if (!token) {
      return;
    }

    // Conectar al WebSocket de observabilidad
    const newSocket = io(`${apiUrl}/observability`, {
      auth: {
        token,
      },
      extraHeaders: {
        'ngrok-skip-browser-warning': '1',
      },
      transports: ['polling', 'websocket'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('subscribe:status');
      newSocket.emit('subscribe:alerts');
      newSocket.emit('subscribe:metrics');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('initial:data', (data) => {
      setMetrics(data);
    });

    newSocket.on('status:update', (status) => {
      setMetrics((prev: any) => ({ ...prev, status }));
    });

    newSocket.on('alert:new', (alert) => {
      // Actualizar alertas
      console.log('New alert:', alert);
    });

    newSocket.on('metrics:update', (metricsData) => {
      setMetrics((prev: any) => ({ ...prev, metrics: metricsData }));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span className="text-sm font-medium">Conexión en Tiempo Real</span>
        </div>
        <Badge variant={connected ? 'default' : 'secondary'}>
          {connected ? (
            <>
              <Zap className="h-3 w-3 mr-1" />
              Conectado
            </>
          ) : (
            'Desconectado'
          )}
        </Badge>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-lg font-bold">
                {metrics.status?.uptime?.toFixed(3) || 'N/A'}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Estado</p>
              <p className="text-lg font-bold capitalize">
                {metrics.status?.status || 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!connected && (
        <div className="text-center text-sm text-muted-foreground py-4">
          Conectando al servidor...
        </div>
      )}
    </div>
  );
}
