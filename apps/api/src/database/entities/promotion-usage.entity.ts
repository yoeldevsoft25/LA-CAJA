import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Promotion } from './promotion.entity';
import { Sale } from './sale.entity';
import { Customer } from './customer.entity';

@Entity('promotion_usages')
@Index(['promotion_id'])
@Index(['sale_id'], { where: 'sale_id IS NOT NULL' })
@Index(['customer_id'], { where: 'customer_id IS NOT NULL' })
export class PromotionUsage {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Promotion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion: Promotion;

  @Column('uuid')
  promotion_id: string;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_applied_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_applied_usd: number;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  used_at: Date;
}
