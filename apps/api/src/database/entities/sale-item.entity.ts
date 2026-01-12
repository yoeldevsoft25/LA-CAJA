import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductLot } from './product-lot.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column('uuid')
  sale_id: string;

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

  @ManyToOne(() => ProductLot, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'lot_id' })
  lot: ProductLot | null;

  @Column({ type: 'uuid', nullable: true })
  lot_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  qty: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_price_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  unit_price_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  discount_usd: number;

  @Column({ type: 'boolean', default: false })
  is_weight_product: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;

  @Column({ type: 'numeric', precision: 18, scale: 3, nullable: true })
  weight_value: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  price_per_weight_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  price_per_weight_usd: number | null;
}
