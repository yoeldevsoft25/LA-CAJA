import {
    Entity,
    Column,
    PrimaryColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('cash_ledger_entries')
@Index(['store_id', 'cash_session_id'])
@Index(['event_id'])
@Index(['request_id'], { unique: true }) // Strong dedupe enforcement
@Index(['store_id', 'created_at']) // For ledger queries by date
export class CashLedgerEntry {
    @PrimaryColumn('uuid')
    id: string;

    @Column('uuid')
    store_id: string;

    @Column('uuid')
    device_id: string;

    @Column({ type: 'bigint' })
    seq: number;

    @Column({ type: 'jsonb', default: '{}' })
    vector_clock: Record<string, number>;

    @Column({ type: 'text' })
    entry_type: 'sale' | 'expense' | 'adjustment' | 'transfer' | 'initial_balance' | 'income';

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    amount_bs: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    amount_usd: number;

    // Mixed currency support (BS, USD, MIXED)
    @Column({ type: 'varchar', length: 10, default: 'BS' })
    currency: string;

    @Column('uuid')
    cash_session_id: string;

    @Column({ type: 'timestamptz' })
    sold_at: Date;

    @Column('uuid')
    event_id: string;

    @Column('uuid')
    request_id: string;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;
}
