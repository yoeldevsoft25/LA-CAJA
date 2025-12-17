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
import { PromotionProduct } from './promotion-product.entity';
import { PromotionUsage } from './promotion-usage.entity';

export type PromotionType =
  | 'percentage'
  | 'fixed_amount'
  | 'buy_x_get_y'
  | 'bundle';

@Entity('promotions')
@Index(['store_id'])
@Index(['store_id', 'is_active', 'valid_from', 'valid_until'], {
  where: 'is_active = true',
})
@Index(['store_id', 'code'], { where: 'code IS NOT NULL' })
@Index(['store_id', 'valid_from', 'valid_until'])
export class Promotion {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50 })
  promotion_type: PromotionType;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  discount_percentage: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  discount_amount_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  discount_amount_usd: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  min_purchase_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  min_purchase_usd: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  max_discount_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  max_discount_usd: number | null;

  @Column({ type: 'timestamptz' })
  valid_from: Date;

  @Column({ type: 'timestamptz' })
  valid_until: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', nullable: true })
  usage_limit: number | null;

  @Column({ type: 'int', default: 0 })
  usage_count: number;

  @Column({ type: 'int', nullable: true })
  customer_limit: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;

  @OneToMany(() => PromotionProduct, (product) => product.promotion, {
    cascade: true,
  })
  products: PromotionProduct[];

  @OneToMany(() => PromotionUsage, (usage) => usage.promotion)
  usages: PromotionUsage[];
}
