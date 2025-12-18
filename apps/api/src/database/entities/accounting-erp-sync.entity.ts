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

export type ERPSystem = 'viotech' | 'sap' | 'oracle' | 'other';
export type ERPSyncType = 'entry' | 'export' | 'config';
export type ERPSyncDirection = 'push' | 'pull' | 'bidirectional';
export type ERPSyncStatus = 'pending' | 'synced' | 'failed' | 'conflict';

@Entity('accounting_erp_syncs')
@Index(['store_id'])
@Index(['erp_system'])
@Index(['sync_type'])
@Index(['status'])
@Index(['source_id'])
export class AccountingERPSync {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'viotech',
  })
  erp_system: ERPSystem;

  @Column({ type: 'varchar', length: 50 })
  sync_type: ERPSyncType;

  @Column('uuid')
  source_id: string;

  @Column({ type: 'varchar', length: 255 })
  erp_id: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'push',
  })
  sync_direction: ERPSyncDirection;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: ERPSyncStatus;

  @Column({ type: 'timestamptz', nullable: true })
  last_sync_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  sync_attempts: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}


