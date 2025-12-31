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

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

@Entity('chart_of_accounts')
@Index(['store_id'])
@Index(['account_code'])
@Index(['account_type'])
@Index(['parent_account_id'])
@Index(['is_active'], { where: 'is_active = true' })
export class ChartOfAccount {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  account_code: string;

  @Column({ type: 'varchar', length: 200 })
  account_name: string;

  @Column({ type: 'varchar', length: 50 })
  account_type: AccountType;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_account_id' })
  parent_account: ChartOfAccount | null;

  @Column({ type: 'uuid', nullable: true })
  parent_account_id: string | null;

  @Column({ type: 'integer', default: 1 })
  level: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: true })
  allows_entries: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}











