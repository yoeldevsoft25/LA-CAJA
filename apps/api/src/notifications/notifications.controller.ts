import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { NotificationsGateway } from './notifications.gateway';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Obtener notificaciones
   */
  @Get()
  async getNotifications(@Request() req: any, @Query() dto: GetNotificationsDto) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.notificationsService.getNotifications(storeId, userId, dto);
  }

  /**
   * Crear notificación
   */
  @Post()
  async createNotification(
    @Request() req: any,
    @Body() dto: CreateNotificationDto,
  ) {
    const storeId = req.user.store_id;
    const notification = await this.notificationsService.createNotification(storeId, dto);

    // Emitir vía WebSocket
    if (dto.user_id) {
      this.gateway.emitToUser(storeId, dto.user_id, notification);
    } else {
      this.gateway.emitToStore(storeId, notification);
    }

    return notification;
  }

  /**
   * Marcar notificación como leída
   */
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Request() req: any, @Param('id') notificationId: string) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    const notification = await this.notificationsService.markAsRead(storeId, userId, notificationId);

    // Actualizar badge vía WebSocket
    await this.gateway.updateBadge(storeId, userId, notification.category);

    return notification;
  }

  /**
   * Marcar todas como leídas
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @Request() req: any,
    @Query('category') category?: string,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    await this.notificationsService.markAllAsRead(storeId, userId, category);

    // Actualizar badge vía WebSocket
    await this.gateway.updateBadge(storeId, userId, category || undefined);

    return { message: 'Todas las notificaciones marcadas como leídas' };
  }

  /**
   * Suscribirse a notificaciones push
   */
  @Post('push/subscribe')
  async subscribePush(@Request() req: any, @Body() dto: SubscribePushDto) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.notificationsService.subscribePush(storeId, userId, dto);
  }

  /**
   * Desuscribirse de notificaciones push
   */
  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribePush(
    @Request() req: any,
    @Body('device_id') deviceId: string,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    await this.notificationsService.unsubscribePush(storeId, userId, deviceId);
    return { message: 'Desuscrito exitosamente' };
  }

  /**
   * Obtener preferencias de notificación
   */
  @Get('preferences')
  async getPreferences(@Request() req: any) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.notificationsService.getPreferences(storeId, userId);
  }

  /**
   * Actualizar preferencia de notificación
   */
  @Put('preferences/:category')
  async updatePreference(
    @Request() req: any,
    @Param('category') category: string,
    @Body() dto: UpdatePreferenceDto,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.notificationsService.updatePreference(storeId, userId, category, dto);
  }

  /**
   * Obtener badge (contador de no leídas)
   */
  @Get('badge')
  async getBadge(
    @Request() req: any,
    @Query('category') category?: string,
  ) {
    const storeId = req.user.store_id;
    const userId = req.user.user_id;
    return this.notificationsService.getBadge(storeId, userId, category);
  }
}

