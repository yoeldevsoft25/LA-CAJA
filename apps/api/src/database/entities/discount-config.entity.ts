import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';

export type AuthorizationRole = 'owner' | 'admin' | 'supervisor' | 'cashier';

@Entity('discount_configs')
@Index(['store_id'])
export class DiscountConfig {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  max_percentage: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  max_amount_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  max_amount_usd: number | null;

  @Column({ type: 'boolean', default: true })
  requires_authorization: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  authorization_role: AuthorizationRole | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  auto_approve_below_percentage: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  auto_approve_below_amount_bs: number | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
