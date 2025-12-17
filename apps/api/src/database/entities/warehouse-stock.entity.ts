import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('warehouse_stock')
@Index(['warehouse_id'])
@Index(['product_id'])
@Index(['variant_id'], { where: 'variant_id IS NOT NULL' })
@Index(['warehouse_id', 'product_id', 'variant_id'], { unique: true })
export class WarehouseStock {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column('uuid')
  warehouse_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @Column({ type: 'uuid', nullable: true })
  variant_id: string | null;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'int', default: 0 })
  reserved: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
