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
import { ChartOfAccount } from './chart-of-accounts.entity';

@Entity('account_balances')
@Index(['store_id'])
@Index(['account_id'])
@Index(['period_start', 'period_end'])
export class AccountBalance {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => ChartOfAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: ChartOfAccount;

  @Column('uuid')
  account_id: string;

  @Column({ type: 'varchar', length: 50 })
  account_code: string;

  @Column({ type: 'date' })
  period_start: Date;

  @Column({ type: 'date' })
  period_end: Date;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_balance_debit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_balance_credit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_balance_debit_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  opening_balance_credit_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  period_debit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  period_credit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  period_debit_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  period_credit_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  closing_balance_debit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  closing_balance_credit_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  closing_balance_debit_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  closing_balance_credit_usd: number;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  last_calculated_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}



