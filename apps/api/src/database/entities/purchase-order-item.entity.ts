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
import { PurchaseOrder } from './purchase-order.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('purchase_order_items')
@Index(['purchase_order_id'])
@Index(['product_id'])
@Index(['variant_id'], { where: 'variant_id IS NOT NULL' })
export class PurchaseOrderItem {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @Column('uuid')
  purchase_order_id: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variant_id: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  quantity_received: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_cost_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_cost_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_cost_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  total_cost_usd: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
