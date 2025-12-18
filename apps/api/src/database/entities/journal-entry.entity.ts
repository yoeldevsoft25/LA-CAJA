import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';
import { JournalEntryLine } from './journal-entry-line.entity';

export type JournalEntryType =
  | 'sale'
  | 'purchase'
  | 'invoice'
  | 'adjustment'
  | 'transfer'
  | 'expense'
  | 'income'
  | 'payment'
  | 'receipt'
  | 'manual';

export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';

@Entity('journal_entries')
@Index(['store_id'])
@Index(['entry_date'])
@Index(['entry_type'])
@Index(['source_type', 'source_id'])
@Index(['status'])
@Index(['exported_to_erp'])
@Index(['erp_sync_id'])
export class JournalEntry {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  entry_number: string;

  @Column({ type: 'date' })
  entry_date: Date;

  @Column({ type: 'varchar', length: 50 })
  entry_type: JournalEntryType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  source_id: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference_number: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_debit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_credit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_debit_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_credit_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  exchange_rate: number | null;

  @Column({ type: 'varchar', length: 3, default: 'BS' })
  currency: 'BS' | 'USD' | 'MIXED';

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status: JournalEntryStatus;

  @Column({ type: 'timestamptz', nullable: true })
  posted_at: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'posted_by' })
  posted_by_user: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  posted_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cancelled_by' })
  cancelled_by_user: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ type: 'boolean', default: false })
  is_auto_generated: boolean;

  @Column({ type: 'boolean', default: false })
  exported_to_erp: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  exported_at: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  erp_sync_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => JournalEntryLine, (line) => line.entry, { cascade: true })
  lines: JournalEntryLine[];
}


