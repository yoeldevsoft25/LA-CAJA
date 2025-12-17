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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  storeId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Cliente ${client.id} intentó conectar sin token`);
        client.disconnect();
        return;
      }

      try {
        const payload = this.jwtService.verify(token);
        client.userId = payload.user_id;
        client.storeId = payload.store_id;

        // Unirse a la sala del usuario
        client.join(`user:${client.storeId}:${client.userId}`);
        client.join(`store:${client.storeId}`);

        this.connectedClients.set(client.id, client);
        this.logger.log(`Cliente ${client.id} conectado (store: ${client.storeId}, user: ${client.userId})`);

        // Enviar estado inicial
        client.emit('connected', {
          store_id: client.storeId,
          user_id: client.userId,
          timestamp: Date.now(),
        });

        // Enviar badge actual
        if (client.storeId && client.userId) {
          const badge = await this.notificationsService.getBadge(client.storeId, client.userId);
          client.emit('badge:update', {
            badge,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        this.logger.warn(`Token inválido para cliente ${client.id}`);
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(`Error en conexión de cliente ${client.id}`, error instanceof Error ? error.stack : String(error));
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Cliente ${client.id} desconectado`);
  }

  /**
   * Suscribirse a notificaciones
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.storeId || !client.userId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    client.emit('subscribed', {
      timestamp: Date.now(),
    });
  }

  /**
   * Obtener notificaciones
   */
  @SubscribeMessage('get:notifications')
  async handleGetNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { limit?: number; is_read?: boolean },
  ) {
    if (!client.storeId || !client.userId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      const notifications = await this.notificationsService.getNotifications(
        client.storeId,
        client.userId,
        {
          limit: data.limit || 50,
          is_read: data.is_read,
        },
      );

      client.emit('notifications', {
        notifications,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Error obteniendo notificaciones para cliente ${client.id}`, error instanceof Error ? error.stack : String(error));
      client.emit('error', {
        message: 'Error obteniendo notificaciones',
      });
    }
  }

  /**
   * Obtener badge
   */
  @SubscribeMessage('get:badge')
  async handleGetBadge(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { category?: string },
  ) {
    if (!client.storeId || !client.userId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    try {
      const badge = await this.notificationsService.getBadge(
        client.storeId,
        client.userId,
        data.category,
      );

      client.emit('badge', {
        badge,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Error obteniendo badge para cliente ${client.id}`, error instanceof Error ? error.stack : String(error));
      client.emit('error', {
        message: 'Error obteniendo badge',
      });
    }
  }

  /**
   * Emitir notificación a usuario específico
   */
  emitToUser(storeId: string, userId: string, notification: any) {
    this.server.to(`user:${storeId}:${userId}`).emit('notification:new', {
      notification,
      timestamp: Date.now(),
    });

    // Actualizar badge
    this.notificationsService.getBadge(storeId, userId, notification.category).then((badge) => {
      this.server.to(`user:${storeId}:${userId}`).emit('badge:update', {
        badge,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Emitir notificación a todo el store
   */
  emitToStore(storeId: string, notification: any) {
    this.server.to(`store:${storeId}`).emit('notification:new', {
      notification,
      timestamp: Date.now(),
    });
  }

  /**
   * Actualizar badge para usuario
   */
  async updateBadge(storeId: string, userId: string, category?: string) {
    const badge = await this.notificationsService.getBadge(storeId, userId, category);
    this.server.to(`user:${storeId}:${userId}`).emit('badge:update', {
      badge,
      timestamp: Date.now(),
    });
  }
}

