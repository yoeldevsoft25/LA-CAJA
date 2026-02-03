import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Store } from './store.entity';
import { RecipeIngredient } from './recipe-ingredient.entity';

@Entity('products')
export class Product {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('uuid')
  store_id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  sku: string | null;

  @Column({ type: 'text', nullable: true })
  barcode: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  price_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  price_usd: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  cost_bs: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  cost_usd: number;

  @Column({ type: 'int', default: 0 })
  low_stock_threshold: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_weight_product: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  price_per_weight_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  price_per_weight_usd: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  cost_per_weight_bs: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
  cost_per_weight_usd: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  min_weight: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  max_weight: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  scale_plu: string | null;

  @Column({ type: 'text', nullable: true })
  image_url: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  is_recipe: boolean;

  @Column({ type: 'varchar', length: 20, default: 'sale_item' })
  product_type: 'sale_item' | 'ingredient' | 'prepared';

  @Column({ type: 'boolean', default: false })
  is_visible_public: boolean;

  @Column({ type: 'text', nullable: true })
  public_name: string | null;

  @Column({ type: 'text', nullable: true })
  public_description: string | null;

  @Column({ type: 'text', nullable: true })
  public_image_url: string | null;

  @Column({ type: 'text', nullable: true })
  public_category: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  profit_margin: number;

  @Column({ type: 'int', nullable: true })
  scale_department: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => RecipeIngredient, (ri) => ri.recipe_product, {
    cascade: true,
  })
  ingredients: RecipeIngredient[];
}
