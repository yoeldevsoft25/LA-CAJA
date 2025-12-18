import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityAuditLog } from '../database/entities/security-audit-log.entity';
import { SecurityAuditService } from './security-audit.service';

/**
 * Módulo de seguridad
 * Proporciona servicios de auditoría y logging de seguridad
 */
@Module({
  imports: [TypeOrmModule.forFeature([SecurityAuditLog])],
  providers: [SecurityAuditService],
  exports: [SecurityAuditService],
})
export class SecurityModule {}


