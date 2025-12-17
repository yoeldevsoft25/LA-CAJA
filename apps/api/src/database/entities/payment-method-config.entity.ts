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
  | 'OTHER'
  | 'SPLIT'
  | 'FIAO';

@Entity('payment_method_configs')
@Index(['store_id'])
@Index(['method'])
export class PaymentMethodConfig {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 20 })
  method: PaymentMethod;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  min_amount_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  min_amount_usd: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  max_amount_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  max_amount_usd: number | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'boolean', default: false })
  requires_authorization: boolean;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
