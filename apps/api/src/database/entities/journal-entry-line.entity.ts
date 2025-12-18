import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { ChartOfAccount } from './chart-of-accounts.entity';

@Entity('journal_entry_lines')
@Index(['entry_id'])
@Index(['account_id'])
@Index(['account_code'])
export class JournalEntryLine {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => JournalEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: JournalEntry;

  @Column('uuid')
  entry_id: string;

  @Column({ type: 'integer' })
  line_number: number;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account: ChartOfAccount;

  @Column('uuid')
  account_id: string;

  @Column({ type: 'varchar', length: 50 })
  account_code: string;

  @Column({ type: 'varchar', length: 200 })
  account_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  debit_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  credit_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  debit_amount_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  credit_amount_usd: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cost_center: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  project_code: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tax_code: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}


