import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column('uuid')
  order_id: string;

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
  qty: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_price_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_price_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_usd: number;

  @Column({ type: 'text', nullable: true })
  note: string | null; // Nota especial del item

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'preparing' | 'ready'; // Estado en cocina

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  added_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;
}
