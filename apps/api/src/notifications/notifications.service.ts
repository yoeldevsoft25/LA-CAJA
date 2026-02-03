import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, QueryFailedError } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';
import { NotificationPreference } from '../database/entities/notification-preference.entity';
import { NotificationSubscription } from '../database/entities/notification-subscription.entity';
import {
  NotificationDelivery,
  DeliveryChannel,
} from '../database/entities/notification-delivery.entity';
import { NotificationBadge } from '../database/entities/notification-badge.entity';
import {
  CreateNotificationDto,
  NotificationType,
  NotificationPriority,
} from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private webPushInitialized = false;

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(NotificationSubscription)
    private subscriptionRepository: Repository<NotificationSubscription>,
    @InjectRepository(NotificationDelivery)
    private deliveryRepository: Repository<NotificationDelivery>,
    @InjectRepository(NotificationBadge)
    private badgeRepository: Repository<NotificationBadge>,
    private configService: ConfigService,
  ) {
    this.initializeWebPush();
  }

  /**
   * Inicializar web-push con VAPID keys
   */
  private initializeWebPush() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      this.configService.get<string>('VAPID_SUBJECT') ||
      'mailto:admin@la-caja.com';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.webPushInitialized = true;
      this.logger.log('Web Push inicializado correctamente');
    } else {
      this.logger.warn(
        'VAPID keys no configuradas. Las notificaciones push no funcionarán.',
      );
    }
  }

  /**
   * Crear notificación
   */
  async createNotification(
    storeId: string,
    dto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      id: randomUUID(),
      store_id: storeId,
      user_id: dto.user_id || null,
      notification_type: dto.notification_type,
      category: dto.category,
      title: dto.title,
      message: dto.message,
      icon: dto.icon || null,
      action_url: dto.action_url || null,
      action_label: dto.action_label || null,
      priority: dto.priority || 'normal',
      severity: dto.severity || null,
      entity_type: (dto.entity_type as any) || null,
      entity_id: dto.entity_id || null,
      metadata: dto.metadata || null,
      delivery_channels: dto.delivery_channels || ['in_app'],
      expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
    });

    const saved = await this.notificationRepository.save(notification);

    // Entregar notificación según preferencias
    await this.deliverNotification(saved);

    // Actualizar badge
    await this.updateBadge(storeId, dto.user_id || null, dto.category);

    return saved;
  }

  /**
   * Entregar notificación según preferencias y canales
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    const storeId = notification.store_id;
    const userId = notification.user_id;

    // Si es notificación global, obtener todos los usuarios del store
    const targetUserIds = userId
      ? [userId]
      : await this.getStoreUserIds(storeId);

    for (const targetUserId of targetUserIds) {
      // Verificar preferencias
      const preference = await this.preferenceRepository.findOne({
        where: {
          store_id: storeId,
          user_id: targetUserId,
          category: notification.category,
        },
      });

      // Si no hay preferencia, usar defaults
      const enabled = preference?.enabled ?? true;
      const channels = preference?.channels ?? ['in_app'];

      if (!enabled) {
        continue;
      }

      // Verificar quiet hours
      if (preference && this.isQuietHours(preference)) {
        this.logger.log(
          `Notificación omitida por quiet hours para usuario ${targetUserId}`,
        );
        continue;
      }

      // Entregar por cada canal habilitado
      for (const channel of channels) {
        if (
          notification.delivery_channels &&
          !notification.delivery_channels.includes(channel)
        ) {
          continue;
        }

        try {
          await this.deliverByChannel(
            notification,
            targetUserId,
            channel as DeliveryChannel,
          );
        } catch (error) {
          this.logger.error(
            `Error entregando notificación ${notification.id} por canal ${channel}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    // Marcar como entregada
    notification.is_delivered = true;
    notification.delivered_at = new Date();
    await this.notificationRepository.save(notification);
  }

  /**
   * Entregar notificación por canal específico
   */
  private async deliverByChannel(
    notification: Notification,
    userId: string,
    channel: DeliveryChannel,
  ): Promise<void> {
    const delivery = this.deliveryRepository.create({
      id: randomUUID(),
      notification_id: notification.id,
      channel,
      status: 'pending',
    });

    await this.deliveryRepository.save(delivery);

    try {
      switch (channel) {
        case 'push':
          await this.sendPushNotification(notification, userId);
          break;
        case 'websocket':
          // Se maneja en el Gateway
          break;
        case 'in_app':
          // Siempre disponible
          break;
        case 'email':
          // Implementar envío de email (futuro)
          break;
      }

      delivery.status = 'sent';
      delivery.delivered_at = new Date();
    } catch (error) {
      delivery.status = 'failed';
      delivery.error_message =
        error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await this.deliveryRepository.save(delivery);
    }
  }

  /**
   * Enviar notificación push
   */
  private async sendPushNotification(
    notification: Notification,
    userId: string,
  ): Promise<void> {
    if (!this.webPushInitialized) {
      throw new Error('Web Push no inicializado');
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: {
        store_id: notification.store_id,
        user_id: userId,
        is_active: true,
      },
    });

    if (subscriptions.length === 0) {
      this.logger.warn(
        `No hay suscripciones push activas para usuario ${userId}`,
      );
      return;
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      icon: notification.icon || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        url: notification.action_url || '/',
        notificationId: notification.id,
        category: notification.category,
      },
      tag: notification.category,
      requireInteraction: notification.priority === 'urgent',
    });

    const promises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          },
          payload,
        );

        // Actualizar last_used_at
        subscription.last_used_at = new Date();
        await this.subscriptionRepository.save(subscription);

        // Crear delivery record
        const delivery = this.deliveryRepository.create({
          id: randomUUID(),
          notification_id: notification.id,
          subscription_id: subscription.id,
          channel: 'push',
          status: 'delivered',
          delivered_at: new Date(),
        });
        await this.deliveryRepository.save(delivery);

        return { success: true, subscriptionId: subscription.id };
      } catch (error) {
        this.logger.error(
          `Error enviando push a suscripción ${subscription.id}`,
          error instanceof Error ? error.stack : String(error),
        );

        // Si la suscripción es inválida (410 Gone), desactivarla
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('410') || errorMessage.includes('Gone')) {
          subscription.is_active = false;
          await this.subscriptionRepository.save(subscription);
          this.logger.warn(
            `Suscripción ${subscription.id} desactivada por ser inválida`,
          );
        }

        // Crear delivery record con estado failed
        const delivery = this.deliveryRepository.create({
          id: randomUUID(),
          notification_id: notification.id,
          subscription_id: subscription.id,
          channel: 'push',
          status: 'failed',
          error_message: errorMessage,
        });
        await this.deliveryRepository.save(delivery);

        return { success: false, subscriptionId: subscription.id, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value?.success,
    ).length;
    const failed = results.length - successful;

    if (successful > 0) {
      this.logger.log(
        `Push notifications enviadas: ${successful} exitosas, ${failed} fallidas`,
      );
    } else if (failed > 0) {
      this.logger.warn(
        `Todas las push notifications fallaron (${failed} intentos)`,
      );
    }
  }

  /**
   * Verificar si estamos en quiet hours
   */
  private isQuietHours(preference: NotificationPreference): boolean {
    if (!preference.quiet_hours_start || !preference.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const start = preference.quiet_hours_start;
    const end = preference.quiet_hours_end;

    // Si start > end, significa que cruza medianoche
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    } else {
      return currentTime >= start && currentTime <= end;
    }
  }

  /**
   * Obtener IDs de usuarios del store
   */
  private async getStoreUserIds(_storeId: string): Promise<string[]> {
    // Implementar según tu modelo de usuarios
    // Por ahora retornar array vacío (se implementará con StoreMember)
    return [];
  }

  /**
   * Obtener notificaciones
   */
  async getNotifications(
    storeId: string,
    userId: string,
    dto: GetNotificationsDto,
  ): Promise<Notification[]> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.store_id = :storeId', { storeId })
      .andWhere(
        '(notification.user_id = :userId OR notification.user_id IS NULL)',
        { userId },
      )
      .orderBy('notification.created_at', 'DESC');

    if (dto.notification_type) {
      query.andWhere('notification.notification_type = :type', {
        type: dto.notification_type,
      });
    }

    if (dto.category) {
      query.andWhere('notification.category = :category', {
        category: dto.category,
      });
    }

    if (dto.is_read !== undefined) {
      query.andWhere('notification.is_read = :isRead', { isRead: dto.is_read });
    }

    if (dto.start_date) {
      query.andWhere('notification.created_at >= :startDate', {
        startDate: dto.start_date,
      });
    }

    if (dto.end_date) {
      query.andWhere('notification.created_at <= :endDate', {
        endDate: dto.end_date,
      });
    }

    if (dto.limit) {
      query.limit(dto.limit);
    }

    return query.getMany();
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(
    storeId: string,
    userId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: {
        id: notificationId,
        store_id: storeId,
        user_id: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    notification.is_read = true;
    notification.read_at = new Date();
    await this.notificationRepository.save(notification);

    // Actualizar badge
    await this.updateBadge(storeId, userId, notification.category);

    return notification;
  }

  /**
   * Marcar todas como leídas
   */
  async markAllAsRead(
    storeId: string,
    userId: string,
    category?: string,
  ): Promise<void> {
    const query = this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({
        is_read: true,
        read_at: new Date(),
      })
      .where('store_id = :storeId', { storeId })
      .andWhere('(user_id = :userId OR user_id IS NULL)', { userId })
      .andWhere('is_read = :isRead', { isRead: false });

    if (category) {
      query.andWhere('category = :category', { category });
    }

    await query.execute();

    // Actualizar badge
    await this.updateBadge(storeId, userId, category || null);
  }

  /**
   * Suscribirse a notificaciones push
   */
  async subscribePush(
    storeId: string,
    userId: string,
    dto: SubscribePushDto,
  ): Promise<NotificationSubscription> {
    try {
      // Validar campos requeridos explícitamente antes de cualquier operación
      if (!dto || typeof dto !== 'object') {
        throw new BadRequestException('DTO inválido o no proporcionado');
      }

      if (
        !dto.endpoint ||
        typeof dto.endpoint !== 'string' ||
        !dto.endpoint.trim()
      ) {
        throw new BadRequestException(
          'endpoint es requerido y debe ser una cadena no vacía',
        );
      }

      if (
        !dto.p256dh_key ||
        typeof dto.p256dh_key !== 'string' ||
        !dto.p256dh_key.trim()
      ) {
        throw new BadRequestException(
          'p256dh_key es requerido y debe ser una cadena no vacía',
        );
      }

      if (
        !dto.auth_key ||
        typeof dto.auth_key !== 'string' ||
        !dto.auth_key.trim()
      ) {
        throw new BadRequestException(
          'auth_key es requerido y debe ser una cadena no vacía',
        );
      }

      if (
        !dto.device_id ||
        typeof dto.device_id !== 'string' ||
        !dto.device_id.trim()
      ) {
        throw new BadRequestException(
          'device_id es requerido y debe ser una cadena no vacía',
        );
      }

      this.logger.debug(
        `Suscribiendo push para store: ${storeId}, user: ${userId}, device: ${dto.device_id}`,
      );

      // Buscar suscripción existente
      let subscription = await this.subscriptionRepository.findOne({
        where: {
          store_id: storeId,
          user_id: userId,
          device_id: dto.device_id,
        },
      });

      if (subscription) {
        // Actualizar suscripción existente
        this.logger.debug(
          `Actualizando suscripción existente: ${subscription.id}`,
        );
        subscription.endpoint = dto.endpoint;
        subscription.p256dh_key = dto.p256dh_key;
        subscription.auth_key = dto.auth_key;
        subscription.user_agent = dto.user_agent || null;
        subscription.is_active = true;
        subscription.last_used_at = new Date();
      } else {
        // Crear nueva suscripción
        this.logger.debug('Creando nueva suscripción push');
        subscription = this.subscriptionRepository.create({
          id: randomUUID(),
          store_id: storeId,
          user_id: userId,
          device_id: dto.device_id,
          endpoint: dto.endpoint,
          p256dh_key: dto.p256dh_key,
          auth_key: dto.auth_key,
          user_agent: dto.user_agent || null,
          is_active: true,
        });
      }

      const saved = await this.subscriptionRepository.save(subscription);
      this.logger.log(
        `Suscripción push exitosa: ${saved.id} para device: ${dto.device_id}`,
      );
      return saved;
    } catch (error) {
      this.logger.error(
        `Error suscribiendo push para store: ${storeId}, user: ${userId}, device: ${dto.device_id}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Si es un error de constraint único (puede ocurrir por race conditions)
      const isUniqueConstraintError =
        error instanceof QueryFailedError &&
        ((error as any).code === '23505' || // PostgreSQL unique violation code
          error.message.includes('unique constraint') ||
          error.message.includes('duplicate key') ||
          error.message.includes('UNIQUE constraint'));

      if (isUniqueConstraintError) {
        // Intentar nuevamente obtener la suscripción existente y actualizarla
        this.logger.warn(
          'Constraint único detectado, intentando recuperar suscripción existente',
        );
        const existing = await this.subscriptionRepository.findOne({
          where: {
            store_id: storeId,
            user_id: userId,
            device_id: dto.device_id,
          },
        });

        if (existing) {
          existing.endpoint = dto.endpoint;
          existing.p256dh_key = dto.p256dh_key;
          existing.auth_key = dto.auth_key;
          existing.user_agent = dto.user_agent || null;
          existing.is_active = true;
          existing.last_used_at = new Date();
          return this.subscriptionRepository.save(existing);
        }
      }

      // Re-lanzar el error si no se pudo manejar
      throw error;
    }
  }

  /**
   * Desuscribirse de notificaciones push
   */
  async unsubscribePush(
    storeId: string,
    userId: string,
    deviceId: string,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        store_id: storeId,
        user_id: userId,
        device_id: deviceId,
      },
    });

    if (subscription) {
      subscription.is_active = false;
      await this.subscriptionRepository.save(subscription);
    }
  }

  /**
   * Obtener preferencias de notificación
   */
  async getPreferences(
    storeId: string,
    userId: string,
  ): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({
      where: {
        store_id: storeId,
        user_id: userId,
      },
    });
  }

  /**
   * Actualizar preferencia de notificación
   */
  async updatePreference(
    storeId: string,
    userId: string,
    category: string,
    dto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    let preference = await this.preferenceRepository.findOne({
      where: {
        store_id: storeId,
        user_id: userId,
        category,
      },
    });

    if (preference) {
      Object.assign(preference, dto);
    } else {
      preference = this.preferenceRepository.create({
        id: randomUUID(),
        store_id: storeId,
        user_id: userId,
        category,
        enabled: dto.enabled ?? true,
        channels: dto.channels ?? ['in_app'],
        quiet_hours_start: dto.quiet_hours_start,
        quiet_hours_end: dto.quiet_hours_end,
        metadata: dto.metadata,
      });
    }

    return this.preferenceRepository.save(preference);
  }

  /**
   * Obtener badge (contador de no leídas)
   */
  async getBadge(
    storeId: string,
    userId: string,
    category?: string,
  ): Promise<NotificationBadge> {
    const whereCondition: any = {
      store_id: storeId,
      user_id: userId,
    };
    if (category !== undefined) {
      whereCondition.category = category || null;
    }

    let badge = await this.badgeRepository.findOne({
      where: whereCondition,
    });

    if (!badge) {
      // Calcular contador actual
      const unreadCount = await this.notificationRepository.count({
        where: {
          store_id: storeId,
          user_id: userId,
          is_read: false,
          ...(category ? { category } : {}),
        },
      });

      badge = this.badgeRepository.create({
        id: randomUUID(),
        store_id: storeId,
        user_id: userId,
        category: category || null,
        unread_count: unreadCount,
      });
      await this.badgeRepository.save(badge);
    }

    return badge;
  }

  /**
   * Actualizar badge
   */
  private async updateBadge(
    storeId: string,
    userId: string | null,
    category: string | null,
  ): Promise<void> {
    if (!userId) return;

    const unreadCount = await this.notificationRepository.count({
      where: {
        store_id: storeId,
        user_id: userId,
        is_read: false,
        ...(category ? { category } : {}),
      },
    });

    const whereCondition: any = {
      store_id: storeId,
      user_id: userId,
    };
    if (category !== undefined) {
      whereCondition.category = category || null;
    }

    let badge = await this.badgeRepository.findOne({
      where: whereCondition,
    });

    if (badge) {
      badge.unread_count = unreadCount;
      badge.last_notification_at = new Date();
      await this.badgeRepository.save(badge);
    } else {
      badge = this.badgeRepository.create({
        id: randomUUID(),
        store_id: storeId,
        user_id: userId,
        category: category || null,
        unread_count: unreadCount,
        last_notification_at: new Date(),
      });
      await this.badgeRepository.save(badge);
    }
  }

  /**
   * Limpiar notificaciones expiradas
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.notificationRepository.delete({
      expires_at: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  /**
   * Crear notificación desde alerta
   */
  async createFromAlert(storeId: string, alert: any): Promise<Notification> {
    const priority =
      alert.severity === 'critical'
        ? NotificationPriority.URGENT
        : alert.severity === 'high'
          ? NotificationPriority.HIGH
          : NotificationPriority.NORMAL;

    return this.createNotification(storeId, {
      notification_type: NotificationType.ALERT,
      category: alert.alert_type,
      title: alert.title,
      message: alert.message,
      priority,
      severity: alert.severity,
      entity_type: alert.entity_type,
      entity_id: alert.entity_id,
      action_url:
        alert.entity_type && alert.entity_id
          ? `/${alert.entity_type}/${alert.entity_id}`
          : undefined,
      delivery_channels: ['push', 'websocket', 'in_app'],
    });
  }
}
