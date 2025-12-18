import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RealTimeAnalyticsService } from './realtime-analytics.service';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  storeId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, restringir a orígenes específicos
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealTimeAnalyticsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealTimeAnalyticsGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly analyticsService: RealTimeAnalyticsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Autenticar cliente mediante token JWT
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Cliente ${client.id} intentó conectar sin token`);
        client.disconnect();
        return;
      }

      try {
        const payload = this.jwtService.verify(token);
        // El JWT usa 'sub' para el user_id, no 'user_id'
        client.userId = payload.sub || payload.user_id;
        client.storeId = payload.store_id;

        // Unirse a la sala del store
        client.join(`store:${client.storeId}`);

        this.connectedClients.set(client.id, client);
        this.logger.log(
          `Cliente ${client.id} conectado (store: ${client.storeId})`,
        );

        // Enviar estado inicial
        client.emit('connected', {
          store_id: client.storeId,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.warn(`Token inválido para cliente ${client.id}`);
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(
        `Error en conexión de cliente ${client.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Cliente ${client.id} desconectado`);
  }

  /**
   * Suscribirse a actualizaciones de métricas
   */
  @SubscribeMessage('subscribe:metrics')
  async handleSubscribeMetrics(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { metric_types?: string[] },
  ) {
    if (!client.storeId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    // Unirse a salas específicas de métricas
    if (data.metric_types && data.metric_types.length > 0) {
      for (const metricType of data.metric_types) {
        client.join(`metrics:${client.storeId}:${metricType}`);
      }
    } else {
      // Suscribirse a todas las métricas del store
      client.join(`metrics:${client.storeId}`);
    }

    client.emit('subscribed', {
      metric_types: data.metric_types || ['all'],
      timestamp: Date.now(),
    });
  }

  /**
   * Suscribirse a alertas
   */
  @SubscribeMessage('subscribe:alerts')
  async handleSubscribeAlerts(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.storeId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    client.join(`alerts:${client.storeId}`);
    client.emit('subscribed', {
      channel: 'alerts',
      timestamp: Date.now(),
    });
  }

  /**
   * Obtener métricas actuales
   */
  @SubscribeMessage('get:metrics')
  async handleGetMetrics(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { metric_type?: string; limit?: number },
  ) {
    if (!client.storeId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      const metrics = await this.analyticsService.getMetrics(client.storeId, {
        metric_type: data.metric_type as any,
        limit: data.limit || 50,
      });

      client.emit('metrics', {
        metrics,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(
        `Error obteniendo métricas para cliente ${client.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit('error', {
        message: 'Error obteniendo métricas',
      });
    }
  }

  /**
   * Obtener alertas
   */
  @SubscribeMessage('get:alerts')
  async handleGetAlerts(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { is_read?: boolean; limit?: number },
  ) {
    if (!client.storeId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      const alerts = await this.analyticsService.getAlerts(client.storeId, {
        is_read: data.is_read,
        limit: data.limit || 50,
      });

      client.emit('alerts', {
        alerts,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(
        `Error obteniendo alertas para cliente ${client.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit('error', {
        message: 'Error obteniendo alertas',
      });
    }
  }

  /**
   * Emitir actualización de métricas a todos los clientes suscritos
   */
  emitMetricUpdate(storeId: string, metric: any, metricType?: string) {
    if (metricType) {
      this.server.to(`metrics:${storeId}:${metricType}`).emit('metric:update', {
        metric,
        timestamp: Date.now(),
      });
    } else {
      this.server.to(`metrics:${storeId}`).emit('metric:update', {
        metric,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Emitir nueva alerta a todos los clientes suscritos
   */
  emitNewAlert(storeId: string, alert: any) {
    this.server.to(`alerts:${storeId}`).emit('alert:new', {
      alert,
      timestamp: Date.now(),
    });
  }

  /**
   * Emitir actualización de heatmap
   */
  emitHeatmapUpdate(storeId: string, heatmap: any) {
    this.server.to(`store:${storeId}`).emit('heatmap:update', {
      heatmap,
      timestamp: Date.now(),
    });
  }
}
