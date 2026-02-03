import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { Profile } from './profile.entity';

export type AccountingExportType = 'csv' | 'excel' | 'json' | 'viotech_sync';
export type AccountingExportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';
export type AccountingStandard = 'IFRS' | 'NIIF' | 'local';

@Entity('accounting_exports')
@Index(['store_id'])
@Index(['export_type'])
@Index(['start_date', 'end_date'])
@Index(['status'])
@Index(['erp_sync_id'])
export class AccountingExport {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  export_type: AccountingExportType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  format_standard: AccountingStandard | null;

  @Column({ type: 'varchar', length: 255 })
  file_name: string;

  @Column({ type: 'text', nullable: true })
  file_path: string | null;

  @Column({ type: 'bigint', nullable: true })
  file_size: number | null;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ type: 'integer', default: 0 })
  entries_count: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_amount_usd: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: AccountingExportStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'exported_by' })
  exporter: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  exported_by: string | null;

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
}
