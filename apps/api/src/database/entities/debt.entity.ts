import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Store } from './store.entity';
import { Customer } from './customer.entity';
import { Sale } from './sale.entity';
import { DebtPayment } from './debt-payment.entity';

export enum DebtStatus {
  OPEN = 'open',
  PARTIAL = 'partial',
  PAID = 'paid',
}

@Entity('debts')
export class Debt {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column('uuid')
  customer_id: string;

  @Column({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_usd: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 20, default: DebtStatus.OPEN })
  status: DebtStatus;

  @OneToMany(() => DebtPayment, (payment) => payment.debt, { cascade: true })
  payments: DebtPayment[];
}
