import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';

export type PaymentMethod =
  | 'CASH_BS'
  | 'CASH_USD'
  | 'PAGO_MOVIL'
  | 'TRANSFER'
  | 'POINT_OF_SALE'
  | 'ZELLE'
  | 'FIAO'
  | 'OTHER';

@Entity('fast_checkout_configs')
@Index(['store_id'])
export class FastCheckoutConfig {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'int', default: 10 })
  max_items: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'boolean', default: false })
  allow_discounts: boolean;

  @Column({ type: 'boolean', default: false })
  allow_customer_selection: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  default_payment_method: PaymentMethod | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
