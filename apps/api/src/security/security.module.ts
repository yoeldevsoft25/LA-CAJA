import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityAuditLog } from '../database/entities/security-audit-log.entity';
import { SecurityAuditService } from './security-audit.service';
import { SecurityAuditController } from './security-audit.controller';

/**
 * Módulo de seguridad
 * Proporciona servicios de auditoría y logging de seguridad
 */
@Module({
  imports: [TypeOrmModule.forFeature([SecurityAuditLog])],
  providers: [SecurityAuditService],
  controllers: [SecurityAuditController],
  exports: [SecurityAuditService],
})
export class SecurityModule {}
