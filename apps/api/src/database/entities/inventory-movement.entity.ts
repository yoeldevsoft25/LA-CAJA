import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Store } from './store.entity';
import { Product } from './product.entity';

export type MovementType = 'received' | 'adjust' | 'sold';

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

  @Column({ type: 'varchar', length: 20 })
  movement_type: MovementType;

  @Column({ type: 'int' })
  qty_delta: number; // Positivo para entradas, negativo para salidas

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_cost_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_cost_usd: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', nullable: true })
  ref: Record<string, any> | null;

  @Column({ type: 'timestamptz' })
  happened_at: Date;
}

