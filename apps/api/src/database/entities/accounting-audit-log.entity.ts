import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('accounting_audit_logs')
export class AccountingAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    @Index()
    store_id: string;

    @Column('uuid')
    user_id: string;

    @Column()
    action: string;

    @Column()
    @Index()
    entity_type: string;

    @Column()
    @Index()
    entity_id: string;

    @Column('jsonb', { nullable: true })
    before_value: Record<string, any>;

    @Column('jsonb', { nullable: true })
    after_value: Record<string, any>;

    @Column('jsonb', { nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    created_at: Date;
}
