import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resend } from 'resend';
// const { Resend } = require('resend');
import { EmailQueue } from '../../database/entities/email-queue.entity';
import { NotificationAnalytics } from '../../database/entities/notification-analytics.entity';
import { randomUUID } from 'crypto';

export interface SendEmailOptions {
  storeId: string;
  notificationId?: string;
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  templateId?: string;
  templateVariables?: Record<string, any>;
  priority?: number;
  scheduledFor?: Date;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

export interface EmailWebhookPayload {
  type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    [key: string]: any;
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private defaultFrom: string;
  private defaultFromName: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(EmailQueue)
    private emailQueueRepository: Repository<EmailQueue>,
    @InjectRepository(NotificationAnalytics)
    private analyticsRepository: Repository<NotificationAnalytics>,
  ) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    // DEBUG LOGS
    console.log('--- EMAIL SERVICE DEBUG ---');
    console.log('RESEND_API_KEY present:', !!resendApiKey);
    if (resendApiKey) {
      console.log('RESEND_API_KEY prefix:', resendApiKey.substring(0, 3));
      console.log('Is Default/Placeholder?', resendApiKey.includes('YOUR_RESEND_API_KEY'));
    }
    console.log('EMAIL_FROM config:', this.configService.get<string>('EMAIL_FROM'));
    console.log('---------------------------');

    if (resendApiKey && resendApiKey !== 're_123456789_YOUR_RESEND_API_KEY_HERE') {
      try {
        this.resend = new Resend(resendApiKey);
        this.logger.log(`✅ Resend Email Service initialized with API key: ${resendApiKey.substring(0, 10)}...`);
      } catch (error) {
        this.logger.error('❌ Failed to initialize Resend:', error);
        this.resend = null;
      }
    } else {
      this.logger.warn('⚠️ RESEND_API_KEY not configured or using placeholder - email sending disabled');
      this.logger.warn('   Configure RESEND_API_KEY in environment variables to enable email sending');
    }

    // Usar dominio de testing de Resend por defecto (no requiere verificación)
    // Para producción, configura EMAIL_FROM con un dominio verificado
    this.defaultFrom =
      this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
    this.defaultFromName =
      this.configService.get<string>('EMAIL_FROM_NAME') || 'LA-CAJA';

    this.logger.log(`📧 Email default FROM: ${this.defaultFromName} <${this.defaultFrom}>`);
    this.logger.log(`   Using Resend domain for testing (change EMAIL_FROM for production)`);
  }

  /**
   * Verifica si el servicio de email está disponible
   */
  isAvailable(): boolean {
    const available = this.resend !== null;
    if (!available) {
      this.logger.warn('📧 Email service is not available (RESEND_API_KEY not configured or invalid)');
    }
    return available;
  }

  /**
   * Envía un email inmediatamente
   */
  async sendEmail(options: SendEmailOptions): Promise<string> {
    if (!this.isAvailable()) {
      this.logger.warn('Email service not available - queueing for later');
      return await this.queueEmail(options);
    }

    const emailId = randomUUID();

    try {
      // Crear registro en queue
      const queueEntry = this.emailQueueRepository.create({
        id: emailId,
        store_id: options.storeId,
        notification_id: options.notificationId || null,
        to_email: options.to,
        to_name: options.toName || null,
        subject: options.subject,
        html_body: options.htmlBody,
        text_body: options.textBody || null,
        template_id: options.templateId || null,
        template_variables: options.templateVariables || null,
        from_email: options.from || this.defaultFrom,
        from_name: options.fromName || this.defaultFromName,
        reply_to: options.replyTo || null,
        priority: options.priority || 50,
        scheduled_for: options.scheduledFor || new Date(),
        status: 'sending',
        attempts: 1,
      });

      await this.emailQueueRepository.save(queueEntry);

      // Enviar con Resend

      // ⚡ FIX: Asegurar que siempre usamos el dominio verificado
      // Si el email en cola tiene un dominio antiguo/no verificado, lo sobrescribimos con la configuración actual
      let finalFromEmail = queueEntry.from_email;
      let finalFromName = queueEntry.from_name;

      // Si tenemos configuración válida, la priorizamos para evitar errores "Domain not verified"
      if (this.defaultFrom && !this.defaultFrom.includes('resend.dev')) {
        finalFromEmail = this.defaultFrom;
        finalFromName = this.defaultFromName || finalFromName;
      }

      const fromAddress = `${finalFromName} <${finalFromEmail}>`;
      this.logger.log(`📤 Attempting to send email via Resend: ${options.to} from ${fromAddress}`);

      // Log extra si hubo override
      if (finalFromEmail !== queueEntry.from_email) {
        this.logger.log(`   (Overridden stale FROM: ${queueEntry.from_email} -> ${finalFromEmail})`);
      }

      const result = await this.resend!.emails.send({
        from: fromAddress,
        to: [options.to],
        subject: options.subject,
        html: options.htmlBody,
        text: options.textBody,
        replyTo: options.replyTo,
      });

      if (result.error) {
        const errorMessage = result.error.message || 'Unknown Resend error';
        this.logger.error(`❌ Resend API error: ${errorMessage}`, result.error);
        throw new Error(`Resend API error: ${errorMessage}`);
      }

      if (!result.data) {
        this.logger.warn('⚠️ Resend returned success but no data/ID');
      } else {
        this.logger.log(`✅ Resend accepted email: ${result.data.id}`);
      }

      // Actualizar queue entry como exitoso
      queueEntry.status = 'sent';
      queueEntry.sent_at = new Date();
      queueEntry.provider_message_id = result.data?.id || null;
      queueEntry.provider_response = result.data as any;

      await this.emailQueueRepository.save(queueEntry);

      // Crear analítica
      if (options.notificationId) {
        await this.createAnalytics({
          storeId: options.storeId,
          notificationId: options.notificationId,
          channel: 'email',
          status: 'sent',
          providerId: result.data?.id,
        });
      }

      this.logger.log(`✅ Email sent successfully: ${emailId} (Resend ID: ${result.data?.id})`);
      return emailId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`❌ Failed to send email ${emailId}: ${errorMessage}`, errorStack);

      // Log detalle del error para debugging
      if (error instanceof Error) {
        this.logger.error(`   Error details: ${error.constructor.name}`, {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        });
      }

      // Marcar como fallido
      const queueEntry = await this.emailQueueRepository.findOne({
        where: { id: emailId },
      });

      if (queueEntry) {
        queueEntry.status = 'failed';
        queueEntry.failed_at = new Date();
        queueEntry.error_message = error instanceof Error ? error.message : 'Unknown error';
        await this.emailQueueRepository.save(queueEntry);
      }

      throw error;
    }
  }

  /**
   * Encola un email para envío posterior
   */
  async queueEmail(options: SendEmailOptions): Promise<string> {
    const emailId = randomUUID();

    const queueEntry = this.emailQueueRepository.create({
      id: emailId,
      store_id: options.storeId,
      notification_id: options.notificationId || null,
      to_email: options.to,
      to_name: options.toName || null,
      subject: options.subject,
      html_body: options.htmlBody,
      text_body: options.textBody || null,
      template_id: options.templateId || null,
      template_variables: options.templateVariables || null,
      from_email: options.from || this.defaultFrom,
      from_name: options.fromName || this.defaultFromName,
      reply_to: options.replyTo || null,
      priority: options.priority || 50,
      scheduled_for: options.scheduledFor || new Date(),
      status: 'pending',
      attempts: 0,
    });

    await this.emailQueueRepository.save(queueEntry);

    this.logger.log(`Email queued: ${emailId}`);
    return emailId;
  }

  /**
   * Procesa emails pendientes en la cola
   */
  async processQueue(batchSize: number = 10): Promise<number> {
    const pendingEmails = await this.emailQueueRepository
      .createQueryBuilder('email')
      .where('email.status = :status', { status: 'pending' })
      .andWhere('email.scheduled_for <= :now', { now: new Date() })
      .andWhere('email.attempts < email.max_attempts')
      .orderBy('email.priority', 'DESC')
      .addOrderBy('email.scheduled_for', 'ASC')
      .limit(batchSize)
      .getMany();

    let processed = 0;

    for (const email of pendingEmails) {
      try {
        await this.sendEmail({
          storeId: email.store_id,
          notificationId: email.notification_id || undefined,
          to: email.to_email,
          toName: email.to_name || undefined,
          subject: email.subject,
          htmlBody: email.html_body,
          textBody: email.text_body || undefined,
          templateId: email.template_id || undefined,
          templateVariables: email.template_variables || undefined,
          from: email.from_email || undefined,
          fromName: email.from_name || undefined,
          replyTo: email.reply_to || undefined,
          priority: email.priority,
        });

        processed++;

        // ⚡ RATE LIMITING: Esperar 1.1 segundos entre envíos para respetar límite de Resend (2 req/s)
        // Esto previene errores 429 durante el procesamiento de lotes
        await new Promise(resolve => setTimeout(resolve, 1100));

      } catch (error) {
        this.logger.error(`Failed to process email ${email.id}:`, error);

        // Incrementar intentos
        email.attempts += 1;

        if (email.attempts >= email.max_attempts) {
          email.status = 'failed';
          email.failed_at = new Date();
        }

        email.error_message = error instanceof Error ? error.message : 'Unknown error';
        await this.emailQueueRepository.save(email);

        // Si fallamos por Rate Limit, esperar un poco más antes de seguir
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (processed > 0) {
      this.logger.log(`Processed ${processed} emails from queue`);
    }

    return processed;
  }

  /**
   * Maneja webhooks de Resend
   */
  async handleWebhook(payload: EmailWebhookPayload): Promise<void> {
    this.logger.log(`Received webhook: ${payload.type}`);

    // Buscar email en queue por provider_message_id
    const email = await this.emailQueueRepository.findOne({
      where: { provider_message_id: payload.data.email_id },
    });

    if (!email) {
      this.logger.warn(`Email not found for webhook: ${payload.data.email_id}`);
      return;
    }

    // Actualizar analíticas basado en el tipo de evento
    if (email.notification_id) {
      const analytics = await this.analyticsRepository.findOne({
        where: {
          notification_id: email.notification_id,
          delivery_channel: 'email',
        },
      });

      if (analytics) {
        switch (payload.type) {
          case 'email.delivered':
            analytics.delivery_status = 'delivered';
            analytics.delivered_at = new Date(payload.created_at);
            break;

          case 'email.opened':
            analytics.opened_at = new Date(payload.created_at);
            analytics.email_opened = true;
            if (analytics.delivered_at) {
              analytics.time_to_open_seconds = Math.floor(
                (new Date(payload.created_at).getTime() - analytics.delivered_at.getTime()) / 1000,
              );
            }
            break;

          case 'email.clicked':
            analytics.clicked_at = new Date(payload.created_at);
            analytics.email_clicked = true;
            if (analytics.delivered_at) {
              analytics.time_to_action_seconds = Math.floor(
                (new Date(payload.created_at).getTime() - analytics.delivered_at.getTime()) / 1000,
              );
            }
            break;

          case 'email.bounced':
            analytics.delivery_status = 'bounced';
            analytics.email_bounced = true;
            email.status = 'bounced';
            break;

          case 'email.complained':
            analytics.email_complained = true;
            break;
        }

        await this.analyticsRepository.save(analytics);
      }
    }

    // Actualizar estado del email en queue
    if (payload.type === 'email.delivered') {
      email.status = 'sent';
    } else if (payload.type === 'email.bounced') {
      email.status = 'bounced';
    }

    await this.emailQueueRepository.save(email);
  }

  /**
   * Obtiene estadísticas de la cola de emails
   */
  async getQueueStats(storeId: string): Promise<{
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    bounced: number;
  }> {
    const stats = await this.emailQueueRepository
      .createQueryBuilder('email')
      .select('email.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('email.store_id = :storeId', { storeId })
      .andWhere('email.created_at >= NOW() - INTERVAL \'30 days\'')
      .groupBy('email.status')
      .getRawMany();

    return {
      pending: parseInt(stats.find((s) => s.status === 'pending')?.count || '0'),
      sending: parseInt(stats.find((s) => s.status === 'sending')?.count || '0'),
      sent: parseInt(stats.find((s) => s.status === 'sent')?.count || '0'),
      failed: parseInt(stats.find((s) => s.status === 'failed')?.count || '0'),
      bounced: parseInt(stats.find((s) => s.status === 'bounced')?.count || '0'),
    };
  }

  /**
   * Crea registro de analíticas
   */
  private async createAnalytics(data: {
    storeId: string;
    notificationId: string;
    channel: string;
    status: string;
    providerId?: string;
  }): Promise<void> {
    // Buscar el user_id de la notificación
    // Por ahora, lo omitimos y lo agregaremos cuando tengamos más contexto
    // Este método será llamado desde el NotificationOrchestrator con más contexto
  }
}
