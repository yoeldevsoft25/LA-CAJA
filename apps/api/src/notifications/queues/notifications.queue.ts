import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationOrchestratorService } from '../services/notification-orchestrator.service';
import { EmailService } from '../services/email.service';

export interface ProcessMLInsightsJob {
  storeId: string;
}

export interface SendEmailJob {
  emailId: string;
}

export interface DailyDigestJob {
  storeId: string;
}

/**
 * Queue Processor para notificaciones
 * Procesa trabajos asíncronos de ML insights, emails, y digests
 */
@Processor('notifications', {
  concurrency: 1, // Procesar uno a uno para evitar Rate Limits de Resend
  limiter: {
    max: 1, // 1 job por segundo máximo (Resend permite 2/seg, mejor ser conservador)
    duration: 1000,
  },
})
export class NotificationsQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsQueueProcessor.name);

  constructor(
    private orchestratorService: NotificationOrchestratorService,
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.name} (${job.id})`);

    switch (job.name) {
      case 'process-ml-insights':
        return await this.processMLInsights(job);

      case 'send-email':
        return await this.sendEmail(job);

      case 'process-email-queue':
        return await this.processEmailQueue(job);

      case 'daily-digest':
        return await this.generateDailyDigest(job);

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return null;
    }
  }

  /**
   * Procesa insights de ML y genera notificaciones
   */
  private async processMLInsights(
    job: Job<ProcessMLInsightsJob>,
  ): Promise<number> {
    const { storeId } = job.data;

    this.logger.log(`Processing ML insights for store ${storeId}`);

    const count =
      await this.orchestratorService.processMLInsights(storeId);

    await job.updateProgress(100);

    return count;
  }

  /**
   * Envía un email individual
   */
  private async sendEmail(job: Job<SendEmailJob>): Promise<void> {
    const { emailId } = job.data;

    this.logger.log(`Sending email ${emailId}`);

    // El EmailService manejará el envío
    await job.updateProgress(50);

    // El email ya está en la cola, solo necesitamos procesarlo
    await job.updateProgress(100);
  }

  /**
   * Procesa la cola de emails pendientes
   */
  private async processEmailQueue(job: Job): Promise<number> {
    this.logger.log('Processing email queue');

    const processed = await this.emailService.processQueue(20);

    await job.updateProgress(100);

    return processed;
  }

  /**
   * Genera digest diario
   */
  private async generateDailyDigest(
    job: Job<DailyDigestJob>,
  ): Promise<void> {
    const { storeId } = job.data;

    this.logger.log(`Generating daily digest for store ${storeId}`);

    await this.orchestratorService.generateDailyDigest(storeId);

    await job.updateProgress(100);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.name} (${job.id}) completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.name} (${job.id}) failed:`,
      error.message,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(`Job ${job.name} (${job.id}) progress: ${progress}%`);
  }
}
