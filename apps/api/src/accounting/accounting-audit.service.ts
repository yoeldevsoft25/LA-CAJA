import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountingAuditLog } from '../database/entities/accounting-audit-log.entity';

@Injectable()
export class AccountingAuditService {
    private readonly logger = new Logger(AccountingAuditService.name);

    constructor(
        @InjectRepository(AccountingAuditLog)
        private readonly auditRepository: Repository<AccountingAuditLog>,
    ) { }

    async logAction(data: {
        store_id: string;
        user_id: string;
        action: string;
        entity_type: string;
        entity_id: string;
        before_value?: any;
        after_value?: any;
        metadata?: any;
    }): Promise<void> {
        try {
            const log = this.auditRepository.create(data);
            await this.auditRepository.save(log);
        } catch (error) {
            this.logger.error(`Failed to log audit entry: ${error.message}`, error.stack);
            // We don't want to fail the main transaction if logging fails, usually.
            // But for strict audit, maybe we do? For now, just log error.
        }
    }

    async getLogs(storeId: string, entityType?: string, entityId?: string): Promise<AccountingAuditLog[]> {
        const query = this.auditRepository.createQueryBuilder('log')
            .where('log.store_id = :storeId', { storeId })
            .orderBy('log.created_at', 'DESC');

        if (entityType) {
            query.andWhere('log.entity_type = :entityType', { entityType });
        }
        if (entityId) {
            query.andWhere('log.entity_id = :entityId', { entityId });
        }

        return query.take(100).getMany();
    }
}
