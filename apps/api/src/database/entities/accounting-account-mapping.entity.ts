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
import { ChartOfAccount } from './chart-of-accounts.entity';

export type TransactionType =
  | 'sale_revenue'
  | 'sale_cost'
  | 'sale_tax'
  | 'purchase_expense'
  | 'purchase_tax'
  | 'inventory_asset'
  | 'cash_asset'
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'expense'
  | 'income'
  | 'transfer'
  | 'adjustment';

@Entity('accounting_account_mappings')
@Index(['store_id'])
@Index(['transaction_type'])
@Index(['is_active'], { where: 'is_active = true' })
export class AccountingAccountMapping {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 50 })
  transaction_type: TransactionType;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'account_id' })
  account: ChartOfAccount;

  @Column('uuid')
  account_id: string;

  @Column({ type: 'varchar', length: 50 })
  account_code: string;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any> | null; // Condiciones específicas

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

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

