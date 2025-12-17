import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Product } from './product.entity';
import { SaleItem } from './sale-item.entity';
import { InventoryMovement } from './inventory-movement.entity';

export type VariantType = 'size' | 'color' | 'material' | 'style' | 'other';

@Entity('product_variants')
@Index(['product_id'])
@Index(['variant_type'])
@Index(['product_id', 'is_active'], { where: 'is_active = true' })
@Index(['barcode'], { where: 'barcode IS NOT NULL' })
@Index(['sku'], { where: 'sku IS NOT NULL' })
export class ProductVariant {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @Column({ type: 'varchar', length: 50 })
  variant_type: VariantType | string;

  @Column({ type: 'varchar', length: 100 })
  variant_value: string;

  @Column({ type: 'text', nullable: true })
  sku: string | null;

  @Column({ type: 'text', nullable: true })
  barcode: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  price_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  price_usd: number | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;

  @OneToMany(() => SaleItem, (saleItem) => saleItem.variant)
  sale_items: SaleItem[];

  @OneToMany(() => InventoryMovement, (movement) => movement.variant)
  inventory_movements: InventoryMovement[];
}
