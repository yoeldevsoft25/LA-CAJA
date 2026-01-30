
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DbRepairService implements OnModuleInit {
    private readonly logger = new Logger(DbRepairService.name);

    constructor(private dataSource: DataSource) { }

    async onModuleInit() {
        this.logger.log('🛠️ Iniciando reparación de base de datos (Emergency Fix)...');
        try {
            await this.createMissingTables();
            this.logger.log('✅ Reparación de base de datos completada.');
        } catch (error) {
            this.logger.error('❌ Error reparando base de datos:', error);
        }
    }

    private async createMissingTables() {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            // 1. Crear tabla email_verification_tokens (Migration 51)
            this.logger.log('Verificando tabla email_verification_tokens...');
            await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
      `);

            // 2. Crear tabla notifications (Migration 30) - Simplificado si no existe
            this.logger.log('Verificando tabla notifications...');
            await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
          user_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE,
          notification_type VARCHAR(50) NOT NULL,
          category VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          icon VARCHAR(100) NULL,
          action_url VARCHAR(500) NULL,
          action_label VARCHAR(100) NULL,
          priority VARCHAR(20) NOT NULL DEFAULT 'normal',
          severity VARCHAR(20) NULL,
          entity_type VARCHAR(50) NULL,
          entity_id UUID NULL,
          metadata JSONB NULL,
          is_read BOOLEAN NOT NULL DEFAULT false,
          read_at TIMESTAMPTZ NULL,
          is_delivered BOOLEAN NOT NULL DEFAULT false,
          delivered_at TIMESTAMPTZ NULL,
          delivery_channels JSONB NULL,
          expires_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

            // 3. Crear tabla notification_templates (Migration 36)
            this.logger.log('Verificando tabla notification_templates...');
            await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS notification_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
          template_key VARCHAR(100) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          content JSONB NOT NULL,
          variables_schema JSONB,
          template_type VARCHAR(50) NOT NULL,
          category VARCHAR(50) NOT NULL,
          ml_trigger_config JSONB,
          email_template TEXT,
          push_template TEXT,
          in_app_template TEXT,
          default_priority VARCHAR(20) DEFAULT 'medium',
          default_channels TEXT[] DEFAULT ARRAY['in_app'],
          is_active BOOLEAN DEFAULT true,
          version INTEGER DEFAULT 1,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_template_key_version UNIQUE(store_id, template_key, version)
        );
      `);

            // 4. Crear tabla email_queue (Migration 36)
            this.logger.log('Verificando tabla email_queue...');
            await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS email_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
          notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
          to_email VARCHAR(255) NOT NULL,
          to_name VARCHAR(255),
          subject VARCHAR(500) NOT NULL,
          html_body TEXT NOT NULL,
          text_body TEXT,
          template_id UUID REFERENCES notification_templates(id),
          template_variables JSONB,
          from_email VARCHAR(255),
          from_name VARCHAR(255),
          reply_to VARCHAR(255),
          priority INTEGER DEFAULT 50,
          scheduled_for TIMESTAMPTZ DEFAULT NOW(),
          status VARCHAR(50) DEFAULT 'pending',
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          provider_message_id VARCHAR(255),
          provider_response JSONB,
          sent_at TIMESTAMPTZ,
          failed_at TIMESTAMPTZ,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_email_queue_store ON email_queue(store_id);
        CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
      `);

        } finally {
            await queryRunner.release();
        }
    }
}
