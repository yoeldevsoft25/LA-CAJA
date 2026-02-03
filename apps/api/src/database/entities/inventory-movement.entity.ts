import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Store } from './store.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Warehouse } from './warehouse.entity';

export type MovementType =
  | 'received'
  | 'adjust'
  | 'sold'
  | 'sale'
  | 'transfer_in'
  | 'transfer_out';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variant_id: string | null;

  @Column({ type: 'varchar', length: 20 })
  movement_type: MovementType;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  qty_delta: number; // Positivo para entradas, negativo para salidas

  @Column({ type: 'boolean', default: true })
  approved: boolean;

  @Column({ type: 'uuid', nullable: true })
  requested_by: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_cost_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_cost_usd: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', nullable: true })
  ref: Record<string, any> | null;

  @ManyToOne(() => Warehouse, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  warehouse_id: string | null;

  @Column({ type: 'timestamptz' })
  happened_at: Date;
}
