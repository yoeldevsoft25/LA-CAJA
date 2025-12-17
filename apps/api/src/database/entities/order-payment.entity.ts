import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';
import { Sale } from './sale.entity';
import { Profile } from './profile.entity';

@Entity('order_payments')
@Index(['order_id'])
@Index(['sale_id'], { where: 'sale_id IS NOT NULL' })
export class OrderPayment {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column('uuid')
  order_id: string;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount_usd: number;

  @Column({ type: 'varchar', length: 50 })
  payment_method: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  paid_at: Date;

  @ManyToOne(() => Profile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paid_by_user_id' })
  paidByUser: Profile | null;

  @Column({ type: 'uuid', nullable: true })
  paid_by_user_id: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;
}
