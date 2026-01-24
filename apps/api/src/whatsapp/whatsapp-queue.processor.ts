import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { WhatsAppMessageQueue } from '../database/entities/whatsapp-message-queue.entity';
import { WhatsAppConfig } from '../database/entities/whatsapp-config.entity';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { Store } from '../database/entities/store.entity';

/**
 * Procesador de cola de mensajes de WhatsApp.
 * - Procesa mensajes pendientes cada 30 s.
 * - En arranque (prod): restaura bots con WhatsApp habilitado y sesión guardada.
 * - Cada 5 min: intenta reconectar bots que tienen sesión pero están desconectados (prod).
 */
@Injectable()
export class WhatsAppQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppQueueProcessor.name);
  private readonly RATE_LIMIT_MESSAGES_PER_MINUTE = 20; // Límite de mensajes por minuto por tienda
  private readonly processingStores = new Map<string, number>(); // Track de mensajes enviados por tienda

  constructor(
    @InjectRepository(WhatsAppMessageQueue)
    private messageQueueRepository: Repository<WhatsAppMessageQueue>,
    @InjectRepository(WhatsAppConfig)
    private whatsappConfigRepository: Repository<WhatsAppConfig>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private whatsappBotService: WhatsAppBotService,
  ) {}

  /**
   * Inicializa bots automáticamente al iniciar el módulo (producción).
   * - Tiendas con mensajes pendientes y sesión guardada.
   * - Tiendas con WhatsApp habilitado (enabled, debt_notifications o debt_reminders) y sesión guardada.
   * Tras un deploy/restart, la conexión se restaura sin depender de mensajes en cola.
   */
  async onModuleInit() {
    this.logger.log('Inicializando procesador de cola de WhatsApp...');

    try {
      // 1) Tiendas con mensajes pendientes
      const pending = await this.messageQueueRepository
        .createQueryBuilder('msg')
        .select('DISTINCT msg.store_id', 'store_id')
        .where('msg.status IN (:...statuses)', { statuses: ['pending', 'retrying'] })
        .getRawMany();

      // 2) Tiendas con WhatsApp habilitado (alguna opción activa) — clave para prod tras restart
      const enabled = await this.whatsappConfigRepository
        .createQueryBuilder('c')
        .select('c.store_id', 'store_id')
        .where('c.enabled = :t OR c.debt_notifications_enabled = :t OR c.debt_reminders_enabled = :t', {
          t: true,
        })
        .getRawMany();

      const allStoreIds = new Set<string>([
        ...pending.map((r) => r.store_id),
        ...enabled.map((r) => r.store_id),
      ]);

      for (const storeId of allStoreIds) {
        const hasSession = this.whatsappBotService.hasSavedSession(storeId);
        const hasBot = this.whatsappBotService.hasBot(storeId);

        if (!hasBot && hasSession) {
          this.logger.log(
            `[Prod] Inicializando bot para tienda ${storeId} (sesión guardada, WhatsApp habilitado o mensajes pendientes)`,
          );
          try {
            await this.whatsappBotService.initializeBot(storeId);
            await new Promise((r) => setTimeout(r, 3000));
            if (this.whatsappBotService.isConnected(storeId)) {
              this.logger.log(`Bot restaurado para tienda ${storeId}`);
            } else {
              this.logger.warn(`Bot inicializado pero aún no conectado para tienda ${storeId}`);
            }
          } catch (error) {
            this.logger.error(`Error inicializando bot para tienda ${storeId}:`, error);
          }
        }
      }

      this.logger.log('Procesador de cola de WhatsApp inicializado');
    } catch (error) {
      this.logger.error('Error en inicialización automática de bots:', error);
    }
  }

  /**
   * Cron: Restaura bots desconectados (producción). Cada 5 minutos.
   * Para tiendas con WhatsApp habilitado y sesión guardada: si no hay bot o hay bot
   * desconectado sin QR y sin "connecting", se llama initializeBot para reconectar.
   */
  @Cron('0 */5 * * * *') // Cada 5 minutos
  async restoreDisconnectedBots() {
    try {
      const configs = await this.whatsappConfigRepository
        .createQueryBuilder('c')
        .select('c.store_id', 'store_id')
        .where(
          'c.enabled = :t OR c.debt_notifications_enabled = :t OR c.debt_reminders_enabled = :t',
          { t: true },
        )
        .getRawMany();

      for (const { store_id } of configs) {
        const hasSession = this.whatsappBotService.hasSavedSession(store_id);
        if (!hasSession) continue;

        const hasBot = this.whatsappBotService.hasBot(store_id);
        const isConnected = this.whatsappBotService.isConnected(store_id);
        const hasQR = this.whatsappBotService.hasActiveQR(store_id);
        const state = this.whatsappBotService.getConnectionState(store_id);

        const shouldRestore =
          !hasBot ||
          (hasBot && !isConnected && !hasQR && (state as string | null) !== 'connecting');

        if (!shouldRestore) continue;

        this.logger.log(`[Prod] Restaurando bot desconectado para tienda ${store_id}`);
        try {
          await this.whatsappBotService.initializeBot(store_id);
        } catch (error) {
          this.logger.warn(`Error restaurando bot para tienda ${store_id}:`, (error as Error)?.message);
        }
      }
    } catch (error) {
      this.logger.error('Error en restauración periódica de bots WhatsApp:', error);
    }
  }

  /**
   * Cron: Procesa cola de mensajes cada 30 segundos
   */
  @Cron('*/30 * * * * *') // Cada 30 segundos
  async processQueue() {
    try {
      // Obtener mensajes pendientes o en retry, ordenados por fecha de creación
      const pendingMessages = await this.messageQueueRepository.find({
        where: [
          { status: 'pending' },
          { status: 'retrying' },
        ],
        order: { created_at: 'ASC' },
        take: 50, // Procesar máximo 50 mensajes por ciclo
      });

      // Filtrar mensajes programados que aún no deben enviarse
      const now = new Date();
      const messagesToProcess = pendingMessages.filter(
        (msg) => !msg.scheduled_for || msg.scheduled_for <= now,
      );

      if (messagesToProcess.length === 0) {
        // Si hay mensajes encontrados pero filtrados (programados), loguear
        if (pendingMessages.length > 0) {
          this.logger.debug(
            `Encontrados ${pendingMessages.length} mensajes pero están programados para más tarde`
          );
        }
        // Solo loguear cada 5 minutos para no saturar logs cuando no hay mensajes
        const shouldLog = Date.now() % 300000 < 30000; // Log cada ~5 minutos
        if (shouldLog) {
          const totalPending = await this.messageQueueRepository.count({
            where: [{ status: 'pending' }, { status: 'retrying' }],
          });
          if (totalPending > 0) {
            this.logger.warn(
              `⚠️ Hay ${totalPending} mensajes pendientes en la cola pero no se están procesando. Verificar estado del bot.`
            );
          } else {
            this.logger.debug(`✅ No hay mensajes pendientes en la cola de WhatsApp`);
          }
        }
        return;
      }

      this.logger.log(`📱 Procesando ${messagesToProcess.length} mensajes pendientes de WhatsApp`);

      // Procesar mensajes agrupados por tienda (para rate limiting)
      const messagesByStore = new Map<string, typeof messagesToProcess>();
      for (const message of messagesToProcess) {
        if (!messagesByStore.has(message.store_id)) {
          messagesByStore.set(message.store_id, []);
        }
        messagesByStore.get(message.store_id)!.push(message);
      }

      // Procesar cada tienda
      for (const [storeId, messages] of messagesByStore) {
        await this.processStoreMessages(storeId, messages);
      }

      // Resetear contadores de rate limiting cada minuto
      this.processingStores.clear();
    } catch (error) {
      this.logger.error('Error procesando cola de mensajes de WhatsApp:', error);
    }
  }

  /**
   * Procesa mensajes de una tienda específica
   */
  private async processStoreMessages(
    storeId: string,
    messages: WhatsAppMessageQueue[],
  ): Promise<void> {
    // Verificar si el bot está conectado
    if (!this.whatsappBotService.isConnected(storeId)) {
      // Intentar inicializar el bot si hay una sesión guardada
      const hasSession = this.whatsappBotService.hasSavedSession(storeId);
      const hasBot = this.whatsappBotService.hasBot(storeId);
      
      if (!hasBot && hasSession) {
        this.logger.log(`Bot no inicializado pero hay sesión guardada para tienda ${storeId}, intentando restaurar conexión...`);
        try {
          await this.whatsappBotService.initializeBot(storeId);
          // Esperar un momento para que Baileys restaure la conexión desde la sesión guardada
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verificar nuevamente si está conectado
          if (!this.whatsappBotService.isConnected(storeId)) {
            this.logger.warn(`Bot inicializado pero aún no conectado para tienda ${storeId}, omitiendo ${messages.length} mensajes`);
            return;
          }
          this.logger.log(`Bot restaurado exitosamente para tienda ${storeId}, procesando ${messages.length} mensajes`);
        } catch (error) {
          this.logger.error(`Error restaurando bot para tienda ${storeId}:`, error);
          this.logger.warn(`Omitiendo ${messages.length} mensajes para tienda ${storeId} - bot no disponible`);
          return;
        }
      } else {
        // Log más visible cuando hay mensajes pero bot no conectado
        this.logger.warn(
          `⚠️ Bot no conectado para tienda ${storeId} (hasBot: ${hasBot}, hasSession: ${hasSession}), ` +
          `omitiendo ${messages.length} mensajes. Inicializa el bot desde la configuración de WhatsApp.`
        );
        return;
      }
    }

    // Rate limiting: verificar cuántos mensajes se han enviado en el último minuto
    const sentCount = this.processingStores.get(storeId) || 0;
    if (sentCount >= this.RATE_LIMIT_MESSAGES_PER_MINUTE) {
      this.logger.warn(`Rate limit alcanzado para tienda ${storeId}, omitiendo mensajes`);
      return;
    }

    // Procesar mensajes (máximo según rate limit)
    const remainingQuota = this.RATE_LIMIT_MESSAGES_PER_MINUTE - sentCount;
    const messagesToProcess = messages.slice(0, remainingQuota);

    for (const message of messagesToProcess) {
      await this.processMessage(message);
      this.processingStores.set(storeId, sentCount + 1);
    }
  }

  /**
   * Procesa un mensaje individual
   */
  private async processMessage(message: WhatsAppMessageQueue): Promise<void> {
    try {
      // Actualizar estado a "retrying" si es la primera vez
      if (message.status === 'pending') {
        message.status = 'retrying';
        message.attempts = 1;
        await this.messageQueueRepository.save(message);
      } else {
        message.attempts += 1;
        await this.messageQueueRepository.save(message);
      }

      // Intentar enviar mensaje
      const result = await this.whatsappBotService.sendMessage(
        message.store_id,
        message.customer_phone,
        message.message,
      );

      if (result.success) {
        // Mensaje enviado exitosamente
        message.status = 'sent';
        message.sent_at = new Date();
        message.error_message = null;
        await this.messageQueueRepository.save(message);
        this.logger.log(
          `Mensaje ${message.id} enviado exitosamente a ${message.customer_phone}`,
        );
      } else {
        // Error al enviar
        message.error_message = result.error || 'Error desconocido';
        this.logger.warn(
          `Error enviando mensaje ${message.id} a ${message.customer_phone}: ${result.error}`,
        );
        await this.handleSendError(message);
      }
    } catch (error: any) {
      this.logger.error(`Error procesando mensaje ${message.id}:`, error);
      message.error_message = error.message || 'Error desconocido';
      await this.handleSendError(message);
    }
  }

  /**
   * Maneja errores al enviar mensajes
   */
  private async handleSendError(message: WhatsAppMessageQueue): Promise<void> {
    if (message.attempts >= message.max_attempts) {
      // Máximo de intentos alcanzado, marcar como fallido
      message.status = 'failed';
      await this.messageQueueRepository.save(message);
      this.logger.warn(
        `Mensaje ${message.id} marcado como fallido después de ${message.attempts} intentos`,
      );
    } else {
      // Reintentar más tarde
      message.status = 'retrying';
      await this.messageQueueRepository.save(message);
      this.logger.debug(
        `Mensaje ${message.id} será reintentado (intento ${message.attempts}/${message.max_attempts})`,
      );
    }
  }
}
