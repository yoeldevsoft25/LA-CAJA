import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Store } from './store.entity';
import { Profile } from './profile.entity';

@Entity('discount_authorizations')
@Index(['sale_id'])
@Index(['store_id'])
@Index(['authorized_by'])
@Index(['authorized_at'])
export class DiscountAuthorization {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column('uuid')
  sale_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  discount_amount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  discount_amount_usd: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  discount_percentage: number;

  @ManyToOne(() => Profile)
  @JoinColumn({ name: 'authorized_by' })
  authorizer: Profile;

  @Column('uuid')
  authorized_by: string;

  @Column({ type: 'text', nullable: true })
  authorization_pin_hash: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  authorized_at: Date;
}
