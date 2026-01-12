import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

@Entity({ name: 'warehouse_stock' })
export class WarehouseStock {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'warehouse_id' })
  warehouse_id: string;

  @Column({ type: 'uuid', name: 'product_id' })
  product_id: string;

  @Column({ type: 'uuid', name: 'variant_id', nullable: true })
  variant_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3, default: 0 })
  stock: number;

  @Column({ type: 'numeric', precision: 18, scale: 3, default: 0 })
  reserved: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  // Relaciones - lazy loading para evitar problemas de alias
  @ManyToOne(() => Warehouse, (warehouse) => warehouse.stock, {
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Promise<Warehouse>;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'product_id' })
  product: Promise<Product>;

  @ManyToOne(() => ProductVariant, {
    onDelete: 'CASCADE',
    nullable: true,
    lazy: true,
  })
  @JoinColumn({ name: 'variant_id' })
  variant: Promise<ProductVariant | null>;
}
