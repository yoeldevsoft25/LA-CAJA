import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { Table } from './table.entity';
import { Customer } from './customer.entity';
import { Profile } from './profile.entity';
import { OrderItem } from './order-item.entity';
import { OrderPayment } from './order-payment.entity';

export type OrderStatus = 'open' | 'paused' | 'closed' | 'cancelled';

@Entity('orders')
@Index(['store_id'])
@Index(['table_id'], { where: 'table_id IS NOT NULL' })
@Index(['store_id', 'status'])
@Index(['store_id', 'opened_at'])
@Index(['store_id', 'order_number'])
export class Order {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Table, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'table_id' })
  table: Table | null;

  @Column({ type: 'uuid', nullable: true })
  table_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  order_number: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: OrderStatus;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  opened_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paused_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'opened_by_user_id' })
  openedByUser: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  opened_by_user_id: string | null;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'closed_by_user_id' })
  closedByUser: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  closed_by_user_id: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => OrderPayment, (payment) => payment.order, { cascade: true })
  payments: OrderPayment[];
}
