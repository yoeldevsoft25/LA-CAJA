import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PriceList } from './price-list.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

@Entity('price_list_items')
export class PriceListItem {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => PriceList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'price_list_id' })
  priceList: PriceList;

  @Column('uuid')
  price_list_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('uuid')
  product_id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variant_id: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  price_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  price_usd: number;

  @Column({ type: 'int', nullable: true })
  min_qty: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date;
}
