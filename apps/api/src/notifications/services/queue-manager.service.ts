import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../../database/entities/store.entity';

/**
 * Queue Manager Service
 * Gestiona colas de trabajos para procesamiento asíncrono
 */
@Injectable()
export class QueueManagerService implements OnModuleInit {
  private readonly logger = new Logger(QueueManagerService.name);

  constructor(
    @InjectQueue('notifications')
    private notificationsQueue: Queue,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
  ) {}

  async onModuleInit() {
    this.logger.log('Queue Manager initialized');
  }

  /**
   * Programa procesamiento de ML insights para una tienda
   */
  async scheduleMLInsightsProcessing(
    storeId: string,
    delay: number = 0,
  ): Promise<void> {
    await this.notificationsQueue.add(
      'process-ml-insights',
      { storeId },
      {
        delay,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(
      `Scheduled ML insights processing for store ${storeId} with delay ${delay}ms`,
    );
  }

  /**
   * Programa envío de email
   */
  async scheduleEmail(emailId: string, priority: number = 50): Promise<void> {
    await this.notificationsQueue.add(
      'send-email',
      { emailId },
      {
        priority,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    );

    this.logger.log(`Scheduled email ${emailId} with priority ${priority}`);
  }

  /**
   * Programa digest diario
   */
  async scheduleDailyDigest(storeId: string, time: Date): Promise<void> {
    const delay = time.getTime() - Date.now();

    if (delay < 0) {
      this.logger.warn(
        `Cannot schedule digest in the past for store ${storeId}`,
      );
      return;
    }

    await this.notificationsQueue.add(
      'daily-digest',
      { storeId },
      {
        delay,
        removeOnComplete: true,
        jobId: `daily-digest-${storeId}-${time.toISOString().split('T')[0]}`,
      },
    );

    this.logger.log(`Scheduled daily digest for store ${storeId} at ${time}`);
  }

  /**
   * Cron: Procesa ML insights cada hora para todas las tiendas activas
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processMLInsightsHourly() {
    const isEnabled =
      process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
      process.env.EMAIL_ENABLED?.toLowerCase() !== 'false';
    if (!isEnabled) return;

    this.logger.log('🤖 Hourly ML insights processing triggered');

    try {
      // Obtener todas las tiendas activas
      const stores = await this.storeRepository.find();

      this.logger.log(`Processing ML insights for ${stores.length} stores`);

      // Programar procesamiento para cada tienda
      for (const store of stores) {
        await this.scheduleMLInsightsProcessing(store.id);
      }

      this.logger.log(
        `✅ Scheduled ML insights processing for ${stores.length} stores`,
      );
    } catch (error) {
      this.logger.error(`Error in hourly ML insights processing:`, error);
    }
  }

  /**
   * Cron: Procesa cola de emails cada 5 minutos
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processEmailQueueCron() {
    const isEnabled =
      process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
      process.env.EMAIL_ENABLED?.toLowerCase() !== 'false';
    if (!isEnabled) return;

    this.logger.log('📧 Email queue processing triggered');

    try {
      await this.notificationsQueue.add(
        'process-email-queue',
        {},
        {
          removeOnComplete: true,
          attempts: 1,
        },
      );

      this.logger.log('✅ Email queue processing job scheduled');
    } catch (error) {
      this.logger.error(`Error scheduling email queue processing:`, error);
    }
  }

  /**
   * Cron: Genera digests diarios a las 8 AM (Hora de Bolivia)
   */
  @Cron('0 8 * * *', {
    timeZone: 'America/La_Paz',
  })
  async generateDailyDigestsCron() {
    const isEnabled =
      process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
      process.env.EMAIL_ENABLED?.toLowerCase() !== 'false';
    if (!isEnabled) return;

    this.logger.log('📊 Daily digests generation triggered (8:00 AM Bolivia)');

    try {
      // Obtener todas las tiendas activas
      const stores = await this.storeRepository.find();

      this.logger.log(`Generating daily digests for ${stores.length} stores`);

      // Programar digest para cada tienda
      for (const store of stores) {
        await this.notificationsQueue.add(
          'daily-digest',
          { storeId: store.id },
          {
            removeOnComplete: true,
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 30000,
            },
          },
        );
      }

      this.logger.log(`✅ Scheduled daily digests for ${stores.length} stores`);
    } catch (error) {
      this.logger.error(`Error generating daily digests:`, error);
    }
  }

  /**
   * Cron: Reporte semanal para owners (Sábado 8 AM Venezuela)
   */
  @Cron('0 8 * * 6', {
    timeZone: 'America/Caracas',
  })
  async generateWeeklyOwnerReportsCron() {
    const isEnabled =
      process.env.QUEUES_ENABLED?.toLowerCase() !== 'false' &&
      process.env.EMAIL_ENABLED?.toLowerCase() !== 'false';
    if (!isEnabled) return;

    this.logger.log('📈 Weekly owner reports triggered (8:00 AM Venezuela)');

    try {
      const stores = await this.storeRepository.find();
      this.logger.log(`Generating weekly reports for ${stores.length} stores`);

      for (const store of stores) {
        await this.notificationsQueue.add(
          'weekly-owner-report',
          { storeId: store.id },
          {
            removeOnComplete: true,
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 30000,
            },
          },
        );
      }

      this.logger.log(
        `✅ Scheduled weekly reports for ${stores.length} stores`,
      );
    } catch (error) {
      this.logger.error(`Error generating weekly owner reports:`, error);
    }
  }

  /**
   * Obtiene estadísticas de la cola
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.notificationsQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  /**
   * Limpia trabajos completados y fallidos antiguos
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldJobs() {
    this.logger.log('🧹 Cleaning up old jobs (Midnight)');

    try {
      // Limpiar trabajos completados más antiguos de 7 días
      const completedCleaned = await this.notificationsQueue.clean(
        7 * 24 * 60 * 60 * 1000,
        1000,
        'completed',
      );

      // Limpiar trabajos fallidos más antiguos de 30 días
      const failedCleaned = await this.notificationsQueue.clean(
        30 * 24 * 60 * 60 * 1000,
        1000,
        'failed',
      );

      this.logger.log(
        `✅ Cleanup completed: ${completedCleaned.length} completed, ${failedCleaned.length} failed jobs removed`,
      );
    } catch (error) {
      this.logger.error(`Error cleaning up old jobs:`, error);
    }
  }
}
